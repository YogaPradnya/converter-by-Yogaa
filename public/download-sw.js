// Download Service Worker v2
// Mencegat request unduhan dan mengembalikan file dengan header Content-Disposition
// Nama file dibaca secara dinamis dari query parameter (?fn=nama_file.mp4)
// sehingga selalu mengikuti format terbaru dari aplikasi.

const CACHE_NAME = "download-cache-v2";

// Aktifkan Service Worker segera tanpa menunggu tab lama ditutup
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Hapus cache versi lama
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Tangani pesan dari main thread untuk menyimpan/menghapus file di cache
self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  if (type === "CACHE_FILE") {
    const { id, data } = payload;
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        // Simpan data mentah tanpa header nama file
        // Nama file akan ditentukan secara dinamis saat request fetch terjadi
        const response = new Response(data, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": data.byteLength || data.size,
          },
        });
        return cache.put(`/download/${id}`, response);
      })
    );
  }

  if (type === "REMOVE_FILE") {
    const { id } = payload;
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.delete(`/download/${id}`);
      })
    );
  }

  if (type === "CLEAR_ALL") {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});

// Intercept request ke /download/* dan sajikan dari cache dengan nama file dinamis
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Hanya tangani request ke /download/
  if (!url.pathname.startsWith("/download/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      // Ambil ID file dari pathname: /download/FILE_ID
      const pathParts = url.pathname.split("/").filter(Boolean);
      const fileId = pathParts[1]; // ["download", "FILE_ID"]
      
      if (!fileId) {
        return new Response("Invalid download URL", { status: 400 });
      }

      // Cari data di cache menggunakan ID saja (tanpa query string)
      const cacheKey = `/download/${fileId}`;

      return cache.match(cacheKey).then((cachedResponse) => {
        if (!cachedResponse) {
          return new Response("File not found in cache", {
            status: 404,
            statusText: "Not Found",
          });
        }

        // Baca nama file dari query parameter ?fn=
        const filename = url.searchParams.get("fn") || "converted.mp4";

        // Buat response baru dengan header Content-Disposition yang mengandung nama file
        // Gunakan format RFC 5987 (filename*=UTF-8'') untuk mendukung karakter Unicode
        const safeFilename = filename.replace(/["\\\r\n]/g, "_");
        const encodedFilename = encodeURIComponent(filename);

        return cachedResponse.arrayBuffer().then((body) => {
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "video/mp4",
              "Content-Length": body.byteLength,
              "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
              "Cache-Control": "no-cache",
            },
          });
        });
      });
    })
  );
});
