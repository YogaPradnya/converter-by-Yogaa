// Wrapper for the FFmpeg Web Worker

let worker = null;
let initPromise = null;
let messageHandlers = new Map();

/**
 * Initialize the FFmpeg Web Worker
 */
export async function getFFmpeg(onLog) {
  if (typeof window === "undefined") return null;

  if (!worker) {
    // Menambahkan query string dinamis (?v=timestamp) untuk mencegah browser/Vercel melakukan cache secara agresif
    worker = new Worker(`/ffmpeg-worker.js?v=${Date.now()}`);
    
    worker.onmessage = (e) => {
      const { type, payload, message } = e.data;
      
      if (type === "log" && onLog) {
        onLog(message);
        return;
      }
      
      // Route message to the correct promise handler based on type and ID
      if (type === "INIT_SUCCESS") {
        const handler = messageHandlers.get("INIT");
        if (handler) handler.resolve();
      } 
      else if (type === "ERROR" && !payload?.id) {
        const handler = messageHandlers.get("INIT");
        if (handler) handler.reject(new Error(payload.message));
      }
      else if (payload?.id) {
        const handler = messageHandlers.get(payload.id);
        if (handler) {
          if (type === "PROGRESS" && handler.onProgress) {
            handler.onProgress(payload.progress);
          } else if (type === "CONVERT_SUCCESS") {
            handler.resolve(new Uint8Array(payload.data));
            messageHandlers.delete(payload.id);
          } else if (type === "ERROR") {
            handler.reject(new Error(payload.message));
            messageHandlers.delete(payload.id);
          }
        }
      }
    };
  }

  // Only initialize once
  if (!initPromise) {
    initPromise = new Promise((resolve, reject) => {
      messageHandlers.set("INIT", { resolve, reject });
      worker.postMessage({ type: "INIT" });
    });
  }

  await initPromise;
  return worker; // Return worker as the "ffmpeg instance"
}

/**
 * Convert a single MKV file to MP4 via the Web Worker.
 */
export async function convertFile(workerInstance, file, outputName, onProgress, hardsubOptions) {
  const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const arrayBuffer = await file.arrayBuffer();
  
  return new Promise((resolve, reject) => {
    messageHandlers.set(id, { resolve, reject, onProgress });
    
    // Send file data to worker
    workerInstance.postMessage({
      type: "CONVERT",
      payload: {
        id,
        fileData: arrayBuffer,
        outputName,
        hardsubOptions
      }
    }, [arrayBuffer]); // Transfer buffer for performance
  });
}

/**
 * Cancel all running conversions by terminating the worker entirely.
 * A new worker will be created on the next getFFmpeg() call.
 */
export async function cancelAllConversions() {
  if (!worker) return;

  // Reject semua pending handlers agar promise tidak menggantung
  for (const [key, handler] of messageHandlers.entries()) {
    if (key !== "INIT" && handler.reject) {
      handler.reject(new Error("Conversion cancelled by user"));
    }
  }
  messageHandlers.clear();

  // Terminate worker secara paksa
  worker.terminate();
  worker = null;
  initPromise = null;
}

/**
 * Create a download link for converted file data and trigger download.
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
  
  // Berikan jeda sebelum menghapus memori agar download tidak dibatalkan paksa
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
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
