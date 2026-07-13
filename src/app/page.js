"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { getFFmpeg, convertFile, downloadFile, formatBytes } from "@/lib/ffmpeg";

let nextFileId = 1;

function generateId() {
  return `file-${nextFileId++}`;
}

/**
 * Apply rename template to a filename.
 */
function applyTemplate(template, originalName, index, startNum) {
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr =
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const num = String(startNum + index);

  return (
    template
      .replace(/\{original\}/g, baseName)
      .replace(/\{index\}/g, num)
      .replace(/\{date\}/g, dateStr)
      .replace(/\{time\}/g, timeStr) + ".mp4"
  );
}

// Toast notification component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`} role="alert">
      <span>{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Close notification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function Home() {
  const [files, setFiles] = useState([]);
  const [renameFormat, setRenameFormat] = useState("{index}_{original}");
  const [autoRenameEnabled, setAutoRenameEnabled] = useState(true);
  const [customStartNumber, setCustomStartNumber] = useState(1);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isZipping, setIsZipping] = useState(false);

  // Hardsub States
  const [hardsubEnabled, setHardsubEnabled] = useState(false);
  const [hardsubOriginalStyle, setHardsubOriginalStyle] = useState(true);
  const [hardsubFontSize, setHardsubFontSize] = useState(20);
  const [hardsubScale, setHardsubScale] = useState(50);
  const [hardsubColor, setHardsubColor] = useState("#ffffff");

  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);
  let toastIdCounter = useRef(0);

  // -- Helpers --
  function hexToAssColor(hex) {
    const r = hex.substring(1, 3);
    const g = hex.substring(3, 5);
    const b = hex.substring(5, 7);
    return `&H00${b}${g}${r}`;
  }

  const addToast = useCallback((message, type = "info") => {
    const id = ++toastIdCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Compute rename previews when format/startNum changes
  useEffect(() => {
    if (!autoRenameEnabled) return;
    setFiles((prev) =>
      prev.map((f, i) => ({
        ...f,
        newName: applyTemplate(renameFormat, f.name, i, customStartNumber),
      }))
    );
  }, [renameFormat, customStartNumber, autoRenameEnabled]);

  // ---- File Management ----

  const addFiles = useCallback(
    (fileList) => {
      const allFiles = Array.from(fileList);
      const mkvFiles = allFiles.filter(
        (f) =>
          f.name.toLowerCase().endsWith(".mkv") ||
          f.type === "video/x-matroska"
      );
      const rejected = allFiles.length - mkvFiles.length;

      if (rejected > 0) {
        addToast(
          `${rejected} file${rejected > 1 ? "s" : ""} rejected (only .mkv accepted)`,
          "warning"
        );
      }

      if (mkvFiles.length === 0) return;

      setFiles((prev) => {
        const newEntries = mkvFiles.map((f, i) => ({
          id: generateId(),
          file: f,
          name: f.name,
          newName: autoRenameEnabled
            ? applyTemplate(renameFormat, f.name, prev.length + i, customStartNumber)
            : f.name.replace(/\.mkv$/i, ".mp4"),
          size: formatBytes(f.size),
          status: "queued",
          progress: 0,
          startTime: null,
          eta: null,
          data: null,
        }));
        return [...prev, ...newEntries];
      });

      addToast(`${mkvFiles.length} file${mkvFiles.length > 1 ? "s" : ""} added to queue`, "success");
    },
    [renameFormat, customStartNumber, autoRenameEnabled, addToast]
  );

  const removeFile = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    if (isConverting) return;
    setFiles([]);
    addToast("Queue cleared", "info");
  }, [isConverting, addToast]);

  // ---- Drag & Drop ----

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  // ---- Batch Rename ----

  const applyBatchRename = useCallback(() => {
    setFiles((prev) =>
      prev.map((f, i) => ({
        ...f,
        newName: applyTemplate(renameFormat, f.name, i, customStartNumber),
      }))
    );
    addToast("Batch rename applied", "success");
  }, [renameFormat, customStartNumber, addToast]);

  // ---- Conversion ----

  const startConversion = useCallback(async () => {
    if (isConverting || files.length === 0) return;

    const queuedFiles = files.filter((f) => f.status === "queued" || f.status === "failed");
    if (queuedFiles.length === 0) {
      addToast("No files to convert (all completed or in progress)", "warning");
      return;
    }

    cancelRef.current = false;
    setIsConverting(true);

    // Load FFmpeg if not ready
    if (!ffmpegReady) {
      setFfmpegLoading(true);
      addToast("Loading FFmpeg engine... this may take a moment on first use", "info");
      try {
        await getFFmpeg();
        setFfmpegReady(true);
        addToast("FFmpeg engine loaded", "success");
      } catch (err) {
        console.error("FFmpeg load failed:", err);
        addToast("Failed to load FFmpeg engine. Check your connection and try again.", "error");
        setFfmpegLoading(false);
        setIsConverting(false);
        return;
      }
      setFfmpegLoading(false);
    }

    const ffmpeg = await getFFmpeg();
    let successCount = 0;
    let failCount = 0;

    // Process each queued/failed file sequentially
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;

      const f = files[i];
      if (f.status !== "queued" && f.status !== "failed") continue;

      const fileId = f.id;

      // Mark as converting
      setFiles((prev) =>
        prev.map((item) =>
          item.id === fileId
            ? { ...item, status: "converting", progress: 0, startTime: Date.now(), eta: null }
            : item
        )
      );

      try {
        const outputName = f.newName || f.name.replace(/\.mkv$/i, ".mp4");

        const hsOptions = {
          enabled: hardsubEnabled,
          originalStyle: hardsubOriginalStyle,
          fontSize: hardsubFontSize,
          scale: hardsubScale,
          primaryColour: hexToAssColor(hardsubColor)
        };

        const data = await convertFile(ffmpeg, f.file, outputName, (ratio) => {
          setFiles((prev) =>
            prev.map((item) => {
              if (item.id === fileId) {
                const progress = Math.round(ratio * 100);
                let eta = null;
                if (item.startTime && progress > 0 && progress < 100) {
                  const elapsed = Date.now() - item.startTime;
                  const totalEstimated = elapsed / (progress / 100);
                  eta = Math.round((totalEstimated - elapsed) / 1000); // seconds
                }
                return { ...item, progress, eta };
              }
              return item;
            })
          );
        });

        if (cancelRef.current) break;

        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: "completed", progress: 100, data }
              : item
          )
        );
        successCount++;
      } catch (err) {
        console.error(`Conversion failed for ${f.name}:`, err);
        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: "failed", progress: 0 }
              : item
          )
        );
        failCount++;
      }
    }

    setIsConverting(false);

    if (cancelRef.current) {
      addToast("Conversion cancelled", "warning");
    } else if (failCount > 0 && successCount > 0) {
      addToast(`Done: ${successCount} converted, ${failCount} failed`, "warning");
    } else if (failCount > 0) {
      addToast(`Conversion failed for ${failCount} file${failCount > 1 ? "s" : ""}`, "error");
    } else if (successCount > 0) {
      addToast(`All ${successCount} file${successCount > 1 ? "s" : ""} converted successfully`, "success");
    }
  }, [files, isConverting, ffmpegReady, addToast]);

  const cancelConversion = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const handleDownload = useCallback((file) => {
    if (file.data) {
      downloadFile(file.data, file.newName || file.name.replace(/\.mkv$/i, ".mp4"));
    }
  }, []);

  const downloadAll = useCallback(() => {
    const completed = files.filter((f) => f.status === "completed" && f.data);
    completed.forEach((f) => {
      downloadFile(f.data, f.newName || f.name.replace(/\.mkv$/i, ".mp4"));
    });
    addToast(`Downloading ${completed.length} file${completed.length > 1 ? "s" : ""}`, "info");
  }, [files, addToast]);

  const downloadZipPart = useCallback(async (startIndex, endIndex) => {
    const completed = files.filter((f) => f.status === "completed" && f.data);
    const chunk = completed.slice(startIndex, endIndex);
    if (chunk.length === 0) return;

    setIsZipping(true);
    addToast(`Menyiapkan ${chunk.length} file untuk ZIP...`, "info");

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Memasukkan setiap file di dalam part ini ke dalam zip
      chunk.forEach((f) => {
        const fileName = f.newName || f.name.replace(/\.mkv$/i, ".mp4");
        zip.file(fileName, f.data);
      });

      // Generate blob file zip
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      const a = document.createElement("a");
      a.href = zipUrl;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const partIndicator = (endIndex - startIndex < completed.length) 
        ? `-part-${Math.floor(startIndex / 20) + 1}` 
        : ``;
      a.download = `converted-videos-${timestamp}${partIndicator}.zip`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);

      addToast("File ZIP berhasil diunduh!", "success");
    } catch (err) {
      console.error("Error zipping files:", err);
      addToast("Gagal membuat file ZIP karena memori penuh.", "error");
    } finally {
      setIsZipping(false);
    }
  }, [files, addToast]);

  // ---- Token helpers ----

  const addToken = (token) => {
    setRenameFormat((prev) => prev + token);
  };

  // ---- Computed stats ----

  const totalFiles = files.length;
  const convertingCount = files.filter((f) => f.status === "converting").length;
  const completedCount = files.filter((f) => f.status === "completed").length;
  const failedCount = files.filter((f) => f.status === "failed").length;
  const hasCompleted = completedCount > 0;

  return (
    <>
      {/* TOAST CONTAINER */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>

      {/* HEADER */}
      <header className="header" id="app-header">
        <div className="header-container">
          <div className="logo-section">
            <div className="logo-icon">
              <img src="/logo.png" alt="MKV Converter" />
            </div>
            <span className="logo-text">MKV Converter</span>
            <span className="badge-pill">Browser</span>
          </div>
          <div className="nav-badges">
            {ffmpegLoading && (
              <span className="badge-pill badge-loading">Loading FFmpeg...</span>
            )}
            {ffmpegReady && (
              <span className="badge-pill badge-ready">Ready</span>
            )}
            {!ffmpegReady && !ffmpegLoading && (
              <span className="badge-pill">FFmpeg.wasm</span>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="app-container" id="main-content">
        {/* LEFT PANEL */}
        <section className="main-panel">
          {/* DROP ZONE */}
          <div
            className={`dropzone${dragOver ? " dragover" : ""}`}
            id="drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mkv,video/x-matroska"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInput}
              id="file-input"
            />
            <div className="dropzone-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
            </div>
            <div>
              <div className="dropzone-title">Drag & Drop MKV files here</div>
              <div className="dropzone-subtitle">
                or click to browse. Only .mkv files accepted. All processing happens offline in your browser.
              </div>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Select Files
            </button>
          </div>

          {/* STATS */}
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-val">{totalFiles}</div>
              <div className="stat-lbl">Total Files</div>
            </div>
            <div className="stat-card">
              <div className="stat-val stat-val-active">{convertingCount}</div>
              <div className="stat-lbl">Converting</div>
            </div>
            <div className="stat-card">
              <div className="stat-val stat-val-success">{completedCount}</div>
              <div className="stat-lbl">Completed</div>
            </div>
          </div>

          {/* FILE LIST */}
          <div className="card" id="file-list-card">
            <div className="panel-header">
              <h3>Queue {totalFiles > 0 && <span className="queue-count">{totalFiles}</span>}</h3>
              <div style={{ display: "flex", gap: "4px" }}>
                {hasCompleted && completedCount > 1 && (
                  <button
                    className="btn-icon"
                    title={completedCount > 20 ? "Unduh ZIP bagian 1" : "Download all as ZIP"}
                    onClick={() => downloadZipPart(0, Math.min(20, completedCount))}
                    disabled={isZipping}
                    type="button"
                  >
                    {isZipping ? (
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>ZIP</span>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  className="btn-icon btn-icon-danger"
                  title="Clear all files"
                  disabled={files.length === 0 || isConverting}
                  onClick={clearFiles}
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            {files.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </div>
                <div className="empty-state-title">No files in queue</div>
                <div className="empty-state-subtitle">
                  Drop MKV files above to get started
                </div>
              </div>
            ) : (
              <div className="file-items">
                {files.map((file) => (
                  <div className="file-row" key={file.id} id={`file-row-${file.id}`}>
                    <div className="file-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      </svg>
                    </div>
                    <div className="file-info">
                      <div className="file-name-container">
                        <span className="file-name-orig" title={file.name}>
                          {file.name}
                        </span>
                        {file.newName && file.newName !== file.name.replace(/\.mkv$/i, ".mp4") && (
                          <>
                            <span className="file-name-arrow">&rarr;</span>
                            <span className="file-name-new" title={file.newName}>
                              {file.newName}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="file-meta-row">
                        <span>{file.size}</span>
                        <span>&bull;</span>
                        <span className={`file-status-badge status-${file.status}`}>
                          {file.status}
                        </span>
                        {file.status === "converting" && (
                          <>
                            <span>&bull; {file.progress}%</span>
                            {file.eta !== null && file.eta > 0 && (
                              <span>&bull; {Math.floor(file.eta / 60)}m {file.eta % 60}s remaining</span>
                            )}
                          </>
                        )}
                      </div>
                      {(file.status === "converting" || file.status === "completed") && (
                        <div className="file-progress-container">
                          <div
                            className="file-progress-bar"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="file-actions">
                      {file.status === "completed" && file.data && (
                        <button
                          className="btn-icon"
                          title="Download"
                          onClick={() => handleDownload(file)}
                          type="button"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                          </svg>
                        </button>
                      )}
                      <button
                        className="btn-icon btn-icon-danger"
                        title="Remove file"
                        onClick={() => removeFile(file.id)}
                        disabled={file.status === "converting"}
                        type="button"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="sidebar-panel">
          {/* RENAME SETTINGS */}
          <div className="settings-card" id="rename-settings">
            <h3 className="settings-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Auto Rename
            </h3>

            <div className="settings-section">
              <label className="toggle-wrapper">
                <span className="toggle-label">Enable Auto-Rename</span>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={autoRenameEnabled}
                  onChange={(e) => setAutoRenameEnabled(e.target.checked)}
                  id="toggle-auto-rename"
                />
                <span className="toggle-track">
                  <span className="toggle-knob" />
                </span>
              </label>
              <span className="field-helper">
                Automatically rename files when added or when the template changes.
              </span>
            </div>

            <div className="settings-section" style={{ opacity: autoRenameEnabled ? 1 : 0.4 }}>
              <label className="settings-label" htmlFor="input-rename-format">
                Template Format
              </label>
              <input
                type="text"
                className="input-text"
                value={renameFormat}
                onChange={(e) => setRenameFormat(e.target.value)}
                disabled={!autoRenameEnabled}
                id="input-rename-format"
                placeholder="e.g. {index}_{original}"
              />
              <div className="token-container">
                {["{original}", "{index}", "{date}", "{time}"].map((token) => (
                  <button
                    key={token}
                    className="token-pill"
                    onClick={() => addToken(token)}
                    disabled={!autoRenameEnabled}
                    title={
                      token === "{original}"
                        ? "Original file name without extension"
                        : token === "{index}"
                          ? "Sequential index number"
                          : token === "{date}"
                            ? "Date (YYYY-MM-DD)"
                            : "Time (HHMMSS)"
                    }
                    type="button"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section" style={{ opacity: autoRenameEnabled ? 1 : 0.4 }}>
              <label className="settings-label" htmlFor="input-start-index">
                Starting Index
              </label>
              <input
                type="number"
                className="input-text"
                value={customStartNumber}
                onChange={(e) => setCustomStartNumber(parseInt(e.target.value) || 1)}
                min="0"
                disabled={!autoRenameEnabled}
                id="input-start-index"
              />
            </div>

            <div className="notice-box">
              <strong>Preview:</strong>
              <div className="notice-preview-value">
                {renameFormat
                  .replace(/\{original\}/g, "sample_video")
                  .replace(/\{index\}/g, String(customStartNumber))
                  .replace(/\{date\}/g, new Date().toISOString().split("T")[0])
                  .replace(/\{time\}/g, "143022") + ".mp4"}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              disabled={Boolean(!autoRenameEnabled || files.length === 0)}
              suppressHydrationWarning
              id="btn-apply-rename"
              type="button"
              onClick={applyBatchRename}
            >
              Apply Batch Rename
            </button>
          </div>

          {/* SUBTITLE SETTINGS */}
          <div className="settings-card" id="subtitle-settings">
            <h3 className="settings-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Subtitle Settings
            </h3>
            
            <div className="settings-section">
              <label className="toggle-wrapper">
                <span className="toggle-label" style={{color: hardsubEnabled ? "#ff4757" : "inherit", fontWeight: hardsubEnabled ? "bold" : "normal"}}>
                  Enable Hardsub (Lambat)
                </span>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={hardsubEnabled}
                  onChange={(e) => setHardsubEnabled(e.target.checked)}
                />
                <span className="toggle-track">
                  <span className="toggle-knob" />
                </span>
              </label>
              <span className="field-helper">
                Membakar subtitle secara permanen pada video. Peringatan: Proses ini <b>sangat lambat</b> pada browser.
              </span>
            </div>

            {hardsubEnabled && (
              <div className="hardsub-options" style={{ marginTop: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e1e4e8' }}>
                
                <div className="settings-section" style={{marginBottom: '12px', borderBottom: '1px solid #e1e4e8', paddingBottom: '12px'}}>
                  <label className="toggle-wrapper" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <input
                      type="checkbox"
                      checked={hardsubOriginalStyle}
                      onChange={(e) => setHardsubOriginalStyle(e.target.checked)}
                      style={{width: '18px', height: '18px'}}
                    />
                    <span className="toggle-label" style={{fontWeight: 'bold', fontSize: '14px', margin: 0}}>
                      Pertahankan Gaya Asli Subtitle (Anime)
                    </span>
                  </label>
                  <span className="field-helper" style={{marginTop: '4px', display: 'block'}}>
                    Centang agar posisi, font, & lirik (Karaoke) tidak rusak saat di-hardsub.
                  </span>
                </div>

                {!hardsubOriginalStyle && (
                  <>
                    <div className="settings-section" style={{marginBottom: '10px'}}>
                      <label className="settings-label">Ukuran Font</label>
                      <input
                        type="number"
                        className="input-text"
                        value={hardsubFontSize}
                        onChange={(e) => setHardsubFontSize(Number(e.target.value))}
                        min="10"
                        max="100"
                      />
                    </div>
                    
                    <div className="settings-section" style={{marginBottom: '10px'}}>
                      <label className="settings-label">Skala (%)</label>
                      <input
                        type="number"
                        className="input-text"
                        value={hardsubScale}
                        onChange={(e) => setHardsubScale(Number(e.target.value))}
                        min="10"
                        max="200"
                      />
                    </div>
                    
                    <div className="settings-section">
                      <label className="settings-label">Warna Teks</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="color"
                          value={hardsubColor}
                          onChange={(e) => setHardsubColor(e.target.value)}
                          style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <span style={{fontFamily: 'monospace'}}>{hardsubColor.toUpperCase()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className="settings-card" id="process-actions">
            <h3 className="settings-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              Convert
            </h3>
            <p className="field-helper">
              {files.length === 0
                ? "Add MKV files to begin conversion."
                : isConverting
                  ? `Converting... ${completedCount}/${totalFiles} done.`
                  : failedCount > 0
                    ? `${failedCount} failed. Click convert to retry.`
                    : completedCount === totalFiles
                      ? `All ${totalFiles} file${totalFiles > 1 ? "s" : ""} converted.`
                      : `Ready to process ${files.length} file${files.length > 1 ? "s" : ""}.`}
            </p>
            {!isConverting ? (
              <button
                className="btn btn-primary"
                disabled={Boolean(files.length === 0 || (completedCount === totalFiles && failedCount === 0 && totalFiles > 0))}
                suppressHydrationWarning
                id="btn-start-convert"
                type="button"
                onClick={startConversion}
              >
                {ffmpegLoading
                  ? "Loading FFmpeg..."
                  : failedCount > 0
                    ? "Retry Failed"
                    : "Convert All to MP4"}
              </button>
            ) : (
              <button
                className="btn btn-danger-outline"
                id="btn-cancel-convert"
                type="button"
                onClick={cancelConversion}
              >
                Cancel Conversion
              </button>
            )}
            {hasCompleted && !isConverting && completedCount > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                {Math.ceil(completedCount / 20) === 1 ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => downloadZipPart(0, completedCount)}
                    disabled={isZipping}
                  >
                    {isZipping ? "Zipping files..." : `Download All as ZIP (${completedCount})`}
                  </button>
                ) : (
                  Array.from({ length: Math.ceil(completedCount / 20) }).map((_, i) => {
                    const start = i * 20;
                    const end = Math.min(start + 20, completedCount);
                    return (
                      <button
                        key={i}
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => downloadZipPart(start, end)}
                        disabled={isZipping}
                      >
                        {isZipping ? "Zipping..." : `Download Part ${i + 1} (${start + 1} - ${end})`}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* FOOTER */}
      <footer className="footer" id="app-footer">
        <p>
          &copy; {new Date().getFullYear()} MKV Converter. Built with Next.js &
          FFmpeg WebAssembly. Private & Offline.
        </p>
      </footer>
    </>
  );
}
