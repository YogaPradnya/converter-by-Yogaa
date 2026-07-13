let ffmpegInstance = null;

/**
 * Convert a URL to a Blob URL.
 * Replaces @ffmpeg/util's toBlobURL since the UMD build has issues.
 */
async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Get or create the singleton FFmpeg instance.
 * Uses FFmpeg loaded globally via script tags in layout.js
 */
export async function getFFmpeg(onLog) {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  // Wait for global FFmpeg to be available (loaded via script tags)
  if (typeof window === "undefined" || !window.FFmpegWASM) {
    throw new Error("FFmpeg library not loaded. Check script tags in layout.js");
  }

  const { FFmpeg } = window.FFmpegWASM;

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on("log", ({ message }) => {
      onLog(message);
    });
  }

  // Use local files from public/ffmpeg (served from same origin)
  const baseURL = "/ffmpeg";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Convert a single MKV file to MP4.
 *
 * @param {object} ffmpeg - loaded FFmpeg instance
 * @param {File} file - the source MKV File object
 * @param {string} outputName - desired output filename (must end in .mp4)
 * @param {(ratio: number) => void} onProgress - progress callback (0-1)
 * @returns {Promise<Uint8Array>} the converted MP4 data
 */
export async function convertFile(ffmpeg, file, outputName, onProgress) {
  const inputName = `input_${Date.now()}.mkv`;

  // Write file bytes to FFmpeg virtual filesystem
  const arrayBuffer = await file.arrayBuffer();
  await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));

  // Listen for progress events
  const progressHandler = ({ progress }) => {
    if (onProgress) {
      onProgress(Math.max(0, Math.min(1, progress)));
    }
  };
  ffmpeg.on("progress", progressHandler);

  try {
    // Run conversion: copy video/audio streams into MP4 container
    // Using -c copy for speed (no re-encoding)
    await ffmpeg.exec([
      "-i",
      inputName,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputName,
    ]);

    // Read the output
    const data = await ffmpeg.readFile(outputName);

    // Cleanup virtual filesystem
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return data;
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}

/**
 * Create a download link for converted file data and trigger download.
 *
 * @param {Uint8Array} data - converted file bytes
 * @param {string} filename - download filename
 */
export function downloadFile(data, filename) {
  const blob = new Blob([data.buffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format bytes to human readable string.
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val < 10 ? 2 : 1)} ${units[i]}`;
}
