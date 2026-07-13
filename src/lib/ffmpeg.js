let ffmpegInstance = null;

/**
 * Get or create the singleton FFmpeg instance.
 * Loads FFmpeg class and utilities directly from CDN to bypass bundler issues.
 */
export async function getFFmpeg(onLog) {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  // Load FFmpeg class directly from CDN ESM build to bypass Turbopack bundling
  const { FFmpeg } = await import(
    /* webpackIgnore: true */
    "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js"
  );
  const { toBlobURL } = await import(
    /* webpackIgnore: true */
    "https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js"
  );

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on("log", ({ message }) => {
      onLog(message);
    });
  }

  const coreBaseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(
      `${coreBaseURL}/ffmpeg-core.wasm`,
      "application/wasm"
    ),
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
