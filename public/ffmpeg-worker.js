// Web Worker for FFmpeg
// This runs in a separate thread, completely isolated from Next.js bundling

// Mock document and window for the UMD build which incorrectly assumes it's in a main thread
self.window = self;
self.document = { 
  currentScript: { src: '' },
  createElement: () => ({}),
  getElementsByTagName: () => ([{ appendChild: () => {} }])
};

// Load the FFmpeg UMD build we downloaded earlier
importScripts('/ffmpeg/ffmpeg.min.js');

let ffmpeg = null;

// Helper to convert URL to Blob URL (needed for FFmpeg core files to bypass cross-origin worker restrictions)
async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

// Initialize FFmpeg
async function initFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return;

  // The UMD build exposes FFmpegWASM on the global self object in a worker
  const { FFmpeg } = self.FFmpegWASM;
  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    self.postMessage({ type: "log", message });
  });

  // Use official unpkg CDN for core files
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  // Inject Poppins Font for Hardsub
  try {
    const fontResponse = await fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf");
    const fontData = await fontResponse.arrayBuffer();
    await ffmpeg.writeFile("Poppins-Regular.ttf", new Uint8Array(fontData));
  } catch (err) {
    console.warn("Gagal mengunduh font Poppins", err);
  }
}

// Handle messages from the main thread
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    if (type === "INIT") {
      await initFFmpeg();
      self.postMessage({ type: "INIT_SUCCESS" });
    } 
    
    else if (type === "CANCEL") {
      // Terminate FFmpeg process secara paksa
      if (ffmpeg) {
        try {
          ffmpeg.terminate();
        } catch (_) {
          // Ignore terminate errors
        }
        ffmpeg = null;
      }
      self.postMessage({ type: "CANCEL_DONE" });
    }
    
    else if (type === "CONVERT") {
      const { id, fileData, outputName, hardsubOptions, resolutionOptions } = payload;
      
      await initFFmpeg(); // Ensure initialized
      
      const ext = outputName.match(/\.[^/.]+$/)?.[0]?.toLowerCase() || ".mp4";
      const inputName = `input_${Date.now()}${ext}`;

      // Write file to virtual FS
      await ffmpeg.writeFile(inputName, new Uint8Array(fileData));

      // Progress handler for this specific conversion
      const progressHandler = ({ progress }) => {
        self.postMessage({ 
          type: "PROGRESS", 
          payload: { id, progress: Math.max(0, Math.min(1, progress)) } 
        });
      };
      
      ffmpeg.on("progress", progressHandler);

      try {
        // Run conversion
        let ffmpegArgs = [];
        const targetRes = resolutionOptions?.target || "original";
        let scaleHeight = null;
        if (targetRes === "1080p") scaleHeight = 1080;
        else if (targetRes === "720p") scaleHeight = 720;
        else if (targetRes === "480p") scaleHeight = 480;
        else if (targetRes === "360p") scaleHeight = 360;

        let filterArgs = [];
        
        // 1. Resolution Scaling
        if (scaleHeight) {
          filterArgs.push(`scale=-2:${scaleHeight}`);
        }

        // 2. Hardsub Options
        if (hardsubOptions && hardsubOptions.enabled) {
          let subFilter = `subtitles=${inputName}:fontsdir=/`;
          if (!hardsubOptions.originalStyle) {
            let forceStyle = `FontSize=${hardsubOptions.fontSize},ScaleX=${hardsubOptions.scale},ScaleY=${hardsubOptions.scale},PrimaryColour=${hardsubOptions.primaryColour}`;
            if (hardsubOptions.overrideFont) forceStyle += `,Fontname=Poppins`;
            subFilter += `:force_style='${forceStyle}'`;
          } else if (hardsubOptions.overrideFont) {
            subFilter += `:force_style='Fontname=Poppins'`;
          }
          filterArgs.push(subFilter);
        }

        if (filterArgs.length > 0) {
          // RE-ENCODE MODE (Scaling and/or Hardsubbing)
          ffmpegArgs = [
            "-i", inputName,
            "-map", "0:v",
            "-map", "0:a?", // Audio opsional
            "-vf", filterArgs.join(","),
            "-c:v", "libx264",
            "-preset", "superfast",
            "-crf", "28",
            "-c:a", "copy",
            "-movflags", "+faststart",
            outputName,
          ];
        } else {
          // SOFTSUB MODE (Fast copy)
          ffmpegArgs = [
            "-i", inputName,
            "-map", "0:v",
            "-map", "0:a?", // Audio opsional
            "-map", "0:s?",
            "-c", "copy",
            "-c:s", "mov_text",
            "-movflags", "+faststart",
            outputName,
          ];
        }

        const exitCode = await ffmpeg.exec(ffmpegArgs);

        if (exitCode !== 0) {
          throw new Error("FFmpeg gagal memproses file ini. Membatalkan konversi.");
        }

        // Read result
        const data = await ffmpeg.readFile(outputName);

        // Cleanup
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);

        // Send success back
        self.postMessage({ 
          type: "CONVERT_SUCCESS", 
          payload: { id, data: data.buffer } 
        }, [data.buffer]); // Transfer buffer for performance

      } finally {
        ffmpeg.off("progress", progressHandler);
      }
    }
  } catch (error) {
    self.postMessage({ 
      type: "ERROR", 
      payload: { 
        id: payload?.id, 
        message: error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
      } 
    });
  }
};
