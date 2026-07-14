// Utilitas untuk mengelola Download Service Worker
// Menyediakan fungsi registrasi, caching, dan pembersihan file unduhan

let swRegistration = null;
let swReady = false;

/**
 * Mendaftarkan Download Service Worker.
 * Dipanggil sekali saat aplikasi pertama kali dimuat.
 */
export async function registerDownloadSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    swRegistration = await navigator.serviceWorker.register("/download-sw.js", {
      scope: "/",
    });

    // Tunggu sampai service worker aktif
    if (swRegistration.active) {
      swReady = true;
    } else {
      await new Promise((resolve) => {
        const sw = swRegistration.installing || swRegistration.waiting;
        if (sw) {
          sw.addEventListener("statechange", () => {
            if (sw.state === "activated") {
              swReady = true;
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    }

    return true;
  } catch (err) {
    console.warn("Download Service Worker registration failed:", err);
    return false;
  }
}

/**
 * Mengecek apakah Service Worker sudah siap digunakan.
 */
export function isDownloadSWReady() {
  return swReady && navigator.serviceWorker && navigator.serviceWorker.controller;
}

/**
 * Menyimpan file hasil konversi ke cache Service Worker (berdasarkan ID saja).
 * @param {string} id - ID unik file
 * @param {Uint8Array|ArrayBuffer} data - Data file video
 * @returns {boolean} true jika berhasil disimpan
 */
export function cacheFileForDownload(id, data) {
  if (!isDownloadSWReady()) return false;

  const buffer = data instanceof Uint8Array ? data.buffer : data;

  navigator.serviceWorker.controller.postMessage({
    type: "CACHE_FILE",
    payload: { id, data: buffer },
  }, [buffer.slice(0)]); // Kirim salinan buffer agar tidak memutus referensi asli

  return true;
}

/**
 * Membuat URL unduhan dinamis melalui Service Worker.
 * Nama file disertakan sebagai query parameter sehingga selalu mengikuti format terbaru.
 * @param {string} id - ID unik file
 * @param {string} filename - Nama file yang diinginkan saat ini
 * @returns {string} URL unduhan (contoh: /download/abc123?fn=1-360p.mp4)
 */
export function getDownloadUrl(id, filename) {
  return `/download/${id}?fn=${encodeURIComponent(filename)}`;
}

/**
 * Menghapus file dari cache Service Worker.
 * @param {string} id - ID unik file
 */
export function removeCachedFile(id) {
  if (!isDownloadSWReady()) return;

  navigator.serviceWorker.controller.postMessage({
    type: "REMOVE_FILE",
    payload: { id },
  });
}

/**
 * Menghapus semua file dari cache Service Worker.
 */
export function clearAllCachedFiles() {
  if (!isDownloadSWReady()) return;

  navigator.serviceWorker.controller.postMessage({
    type: "CLEAR_ALL",
  });
}
