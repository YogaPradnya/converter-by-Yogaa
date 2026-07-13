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
}

// Handle messages from the main thread
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    if (type === "INIT") {
      await initFFmpeg();
      self.postMessage({ type: "INIT_SUCCESS" });
    } 
    
    else if (type === "CONVERT") {
      const { id, fileData, outputName, hardsubOptions } = payload;
      
      await initFFmpeg(); // Ensure initialized
      
      const inputName = `input_${Date.now()}.mkv`;

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
        console.log("[Worker] Menerima opsi hardsub:", hardsubOptions);
        
        if (hardsubOptions && hardsubOptions.enabled) {
          // HARDSUB MODE (Re-encode)
          const { fontSize, scale, primaryColour, originalStyle } = hardsubOptions;
          
          let filterArgs = `subtitles=${inputName}`;
          if (!originalStyle) {
            const forceStyle = `FontSize=${fontSize},ScaleX=${scale},ScaleY=${scale},PrimaryColour=${primaryColour}`;
            filterArgs += `:force_style='${forceStyle}'`;
          }
          
          ffmpegArgs = [
            "-i", inputName,
            "-map", "0:v",
            "-map", "0:a?", // Audio opsional
            "-vf", filterArgs,
            "-c:v", "libx264",
            "-preset", "ultrafast",
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

        console.log("[Worker] Mengeksekusi FFmpeg dengan argumen:", ffmpegArgs.join(" "));
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
