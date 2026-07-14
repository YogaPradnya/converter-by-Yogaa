"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { downloadFile, formatBytes } from "@/lib/ffmpeg";
import { generateId, applyTemplate } from "@/app/utils/helpers";
import { useToast } from "@/app/hooks/useToast";
import { useTheme } from "@/app/hooks/useTheme";
import { useFFmpegConverter } from "@/app/hooks/useFFmpegConverter";
import Toast from "@/app/components/Toast";
import DropZone from "@/app/components/DropZone";
import FileList from "@/app/components/FileList";
import RenameSettings from "@/app/components/RenameSettings";
import SubtitleSettings from "@/app/components/SubtitleSettings";
import ResolutionSettings from "@/app/components/ResolutionSettings";
import ConvertActions from "@/app/components/ConvertActions";
import ConfirmModal from "@/app/components/ConfirmModal";

export default function Home() {
  // -- Navigation State --
  const [activeTab, setActiveTab] = useState("mkvtomp4"); // "mkvtomp4" | "resizer"

  // -- File Queue States (Separated) --
  const [mkvFiles, setMkvFiles] = useState([]);
  const [resizerFiles, setResizerFiles] = useState([]);

  // Active queue getters and setters
  const files = activeTab === "mkvtomp4" ? mkvFiles : resizerFiles;
  const setFiles = activeTab === "mkvtomp4" ? setMkvFiles : setResizerFiles;

  // -- Rename State --
  const [renameFormat, setRenameFormat] = useState("{index}-360p");
  const [autoRenameEnabled, setAutoRenameEnabled] = useState(true);
  const [customStartNumber, setCustomStartNumber] = useState(1);

  // -- Drag & Drop State --
  const [dragOver, setDragOver] = useState(false);

  // -- ZIP State --
  const [isZipping, setIsZipping] = useState(false);

  // -- Modal State --
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // -- Hardsub State (Only for MKV to MP4) --
  const [hardsubEnabled, setHardsubEnabled] = useState(false);
  const [hardsubOriginalStyle, setHardsubOriginalStyle] = useState(true);
  const [hardsubOverrideFont, setHardsubOverrideFont] = useState(false);
  const [hardsubFontSize, setHardsubFontSize] = useState(20);
  const [hardsubScale, setHardsubScale] = useState(50);
  const [hardsubColor, setHardsubColor] = useState("#ffffff");

  // -- Resolution State (Only for Video Resizer) --
  const [videoResolution, setVideoResolution] = useState("original");

  // -- UI State --
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  // -- Hooks --
  const { toasts, addToast, removeToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const hardsubConfig = {
    enabled: hardsubEnabled,
    originalStyle: hardsubOriginalStyle,
    overrideFont: hardsubOverrideFont,
    fontSize: hardsubFontSize,
    scale: hardsubScale,
    color: hardsubColor,
  };

  const {
    ffmpegReady,
    ffmpegLoading,
    isConverting,
    startConversion,
    cancelConversion,
  } = useFFmpegConverter({
    files,
    setFiles,
    addToast,
    hardsubConfig,
    resolution: videoResolution,
    activeTab,
  });

  // -- Hapus / Unregister Service Worker jika pernah terdaftar --
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);

  // -- Memory Cleanup for Blob URLs on Unmount --
  const mkvFilesRef = useRef(mkvFiles);
  const resizerFilesRef = useRef(resizerFiles);

  useEffect(() => {
    mkvFilesRef.current = mkvFiles;
  }, [mkvFiles]);

  useEffect(() => {
    resizerFilesRef.current = resizerFiles;
  }, [resizerFiles]);

  useEffect(() => {
    return () => {
      mkvFilesRef.current.forEach((f) => {
        if (f.blobUrl) URL.revokeObjectURL(f.blobUrl);
      });
      resizerFilesRef.current.forEach((f) => {
        if (f.blobUrl) URL.revokeObjectURL(f.blobUrl);
      });
    };
  }, []);

  // -- Rename preview sync --
  useEffect(() => {
    if (!autoRenameEnabled) return;
    const targetExt = activeTab === "resizer" ? null : ".mp4";
    setFiles((prev) =>
      prev.map((f, i) => {
        const newName = applyTemplate(renameFormat, f.name, i, customStartNumber, targetExt);
        if (f.newName === newName) return f;

        // Recreate blobUrl dengan File object nama baru jika file sudah completed
        let updatedBlobUrl = f.blobUrl;
        if (f.status === "completed" && f.data) {
          if (f.blobUrl) {
            URL.revokeObjectURL(f.blobUrl);
          }
          const ext = newName.match(/\.[^/.]+$/)?.[0]?.toLowerCase() || ".mp4";
          let mimeType = "video/mp4";
          if (ext === ".mkv") mimeType = "video/x-matroska";
          else if (ext === ".webm") mimeType = "video/webm";
          else if (ext === ".avi") mimeType = "video/x-msvideo";
          else if (ext === ".mov") mimeType = "video/quicktime";

          const fileObj = new File([f.data.buffer], newName, { type: mimeType });
          updatedBlobUrl = URL.createObjectURL(fileObj);
        }

        return {
          ...f,
          newName,
          blobUrl: updatedBlobUrl,
        };
      })
    );
  }, [renameFormat, customStartNumber, autoRenameEnabled, activeTab]);

  // -- File Management --

  const addFiles = useCallback(
    (fileList) => {
      const allFiles = Array.from(fileList);
      let acceptedFiles = [];
      let rejected = 0;

      if (activeTab === "mkvtomp4") {
        acceptedFiles = allFiles.filter(
          (f) =>
            f.name.toLowerCase().endsWith(".mkv") ||
            f.type === "video/x-matroska"
        );
        rejected = allFiles.length - acceptedFiles.length;
        if (rejected > 0) {
          addToast(
            `${rejected} file${rejected > 1 ? "s" : ""} ditolak (hanya file .mkv yang diterima)`,
            "warning"
          );
        }
      } else {
        // Video Resizer: Terima semua format video
        acceptedFiles = allFiles.filter(
          (f) =>
            f.type.startsWith("video/") ||
            /\.(mkv|mp4|webm|avi|mov|m4v|flv|wmv|3gp)$/i.test(f.name)
        );
        rejected = allFiles.length - acceptedFiles.length;
        if (rejected > 0) {
          addToast(
            `${rejected} file${rejected > 1 ? "s" : ""} ditolak (hanya file video yang diterima)`,
            "warning"
          );
        }
      }

      if (acceptedFiles.length === 0) return;

      setFiles((prev) => {
        const newEntries = acceptedFiles.map((f, i) => {
          const targetExt = activeTab === "resizer" ? null : ".mp4";
          const newName = autoRenameEnabled
            ? applyTemplate(renameFormat, f.name, prev.length + i, customStartNumber, targetExt)
            : (activeTab === "resizer" ? f.name : f.name.replace(/\.mkv$/i, ".mp4"));

          return {
            id: generateId(),
            file: f,
            name: f.name,
            newName,
            size: formatBytes(f.size),
            status: "queued",
            progress: 0,
            startTime: null,
            eta: null,
            data: null,
          };
        });
        return [...prev, ...newEntries];
      });

      addToast(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? "s" : ""} ditambahkan ke antrean`, "success");
    },
    [renameFormat, customStartNumber, autoRenameEnabled, addToast, activeTab]
  );

  const removeFile = useCallback((id) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        if (fileToRemove.blobUrl) {
          URL.revokeObjectURL(fileToRemove.blobUrl);
        }
      }
      return prev.filter((f) => f.id !== id);
    });
  }, [setFiles]);

  const reorderFiles = useCallback((dragIndex, hoverIndex) => {
    if (isConverting) return; // Prevent reorder during conversion
    setFiles((prev) => {
      const newFiles = [...prev];
      const draggedFile = newFiles[dragIndex];
      newFiles.splice(dragIndex, 1);
      newFiles.splice(hoverIndex, 0, draggedFile);
      return newFiles;
    });
  }, [isConverting, setFiles]);

  const clearFiles = useCallback(() => {
    if (isConverting) return;
    const hasCompleted = files.some((f) => f.status === "completed" && f.data);
    if (hasCompleted) {
      setShowClearConfirm(true);
      return;
    }
    files.forEach((f) => {
      if (f.blobUrl) {
        URL.revokeObjectURL(f.blobUrl);
      }
    });
    setFiles([]);
    addToast("Queue cleared", "info");
  }, [isConverting, files, addToast, setFiles]);

  const confirmClear = useCallback(() => {
    setShowClearConfirm(false);
    files.forEach((f) => {
      if (f.blobUrl) {
        URL.revokeObjectURL(f.blobUrl);
      }
    });
    setFiles([]);
    addToast("Queue cleared", "info");
  }, [addToast, files, setFiles]);

  // -- Drag & Drop Handlers --

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

  // -- Download Handlers --

  const handleDownload = useCallback((file) => {
    const isResizer = activeTab === "resizer";
    const filename = file.newName || (isResizer ? file.name : file.name.replace(/\.mkv$/i, ".mp4"));

    // Unduh langsung via blobUrl atau data mentah
    if (file.blobUrl) {
      downloadFile(file.blobUrl, filename);
    } else if (file.data) {
      downloadFile(file.data, filename);
    }
  }, [activeTab]);

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
        const isResizer = activeTab === "resizer";
        const fileName = f.newName || (isResizer ? f.name : f.name.replace(/\.mkv$/i, ".mp4"));
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
  }, [files, addToast, activeTab]);

  // -- Batch Rename --

  const applyBatchRename = useCallback(() => {
    const targetExt = activeTab === "resizer" ? null : ".mp4";
    setFiles((prev) =>
      prev.map((f, i) => ({
        ...f,
        newName: applyTemplate(renameFormat, f.name, i, customStartNumber, targetExt),
      }))
    );
    addToast("Batch rename applied", "success");
  }, [renameFormat, customStartNumber, addToast, activeTab, setFiles]);

  // -- Computed Stats --

  const totalFiles = files.length;
  const completedCount = files.filter((f) => f.status === "completed").length;
  const convertingCount = files.filter((f) => f.status === "converting").length;
  const failedCount = files.filter((f) => f.status === "failed").length;

  return (
    <>
      {/* CONFIRM MODAL */}
      {showClearConfirm && (
        <ConfirmModal
          title="Hapus Semua File?"
          message="Ada file yang sudah selesai dikonversi tapi belum diunduh. Yakin ingin menghapus semua file dari queue?"
          onConfirm={confirmClear}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

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
            <div className="logo-icon" style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="m10 11 3 3-3 3" />
                <path d="m14 11 3 3-3 3" />
              </svg>
            </div>
            <span className="logo-text">MKV Converter</span>
          </div>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              title={theme === "light" ? "Dark mode" : "Light mode"}
              type="button"
              id="theme-toggle-btn"
            >
              {theme === "light" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="app-container" id="main-content">
        {/* Navigation Tabs Bar */}
        <div className="nav-tabs" style={{ gridColumn: "1 / -1" }}>
          <button
            className={`nav-tab ${activeTab === "mkvtomp4" ? "active" : ""}`}
            onClick={() => setActiveTab("mkvtomp4")}
            disabled={isConverting}
            type="button"
          >
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="m10 11 3 3-3 3" />
              <path d="m14 11 3 3-3 3" />
            </svg>
            Convert MKV to MP4
          </button>
          <button
            className={`nav-tab ${activeTab === "resizer" ? "active" : ""}`}
            onClick={() => setActiveTab("resizer")}
            disabled={isConverting}
            type="button"
          >
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Video Resolution Resizer
          </button>
        </div>

        {/* LEFT PANEL */}
        <section className="main-panel">
          <DropZone
            onFilesAdded={addFiles}
            dragOver={dragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            activeTab={activeTab}
          />

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

          <FileList
            files={files}
            isConverting={isConverting}
            isZipping={isZipping}
            onRemoveFile={removeFile}
            onDownloadFile={handleDownload}
            onDownloadZip={downloadZipPart}
            onClearFiles={clearFiles}
            onReorder={reorderFiles}
          />
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="sidebar-panel">
          <div className="mobile-settings-wrapper">
            <div 
              className="mobile-settings-toggle settings-title mobile-only-flex"
              onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
              style={{ cursor: "pointer", justifyContent: "space-between", padding: "var(--sp-md)", background: "var(--surface-card)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-xs)", fontSize: "18px", fontWeight: "600", color: "var(--ink)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Settings
              </div>
              <svg 
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isMobileSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            <div className={`mobile-settings-content ${isMobileSettingsOpen ? 'open' : ''}`}>
              <RenameSettings
                autoRenameEnabled={autoRenameEnabled}
                onAutoRenameToggle={setAutoRenameEnabled}
                renameFormat={renameFormat}
                onRenameFormatChange={setRenameFormat}
                customStartNumber={customStartNumber}
                onStartNumberChange={setCustomStartNumber}
                onApplyBatchRename={applyBatchRename}
                filesCount={totalFiles}
              />

              {activeTab === "mkvtomp4" ? (
                <SubtitleSettings
                  hardsubEnabled={hardsubEnabled}
                  onHardsubToggle={setHardsubEnabled}
                  hardsubOriginalStyle={hardsubOriginalStyle}
                  onOriginalStyleToggle={setHardsubOriginalStyle}
                  hardsubOverrideFont={hardsubOverrideFont}
                  onOverrideFontToggle={setHardsubOverrideFont}
                  hardsubFontSize={hardsubFontSize}
                  onFontSizeChange={setHardsubFontSize}
                  hardsubScale={hardsubScale}
                  onScaleChange={setHardsubScale}
                  hardsubColor={hardsubColor}
                  onColorChange={setHardsubColor}
                />
              ) : (
                <ResolutionSettings
                  resolution={videoResolution}
                  onResolutionChange={setVideoResolution}
                />
              )}
            </div>
          </div>

          <ConvertActions
            files={files}
            isConverting={isConverting}
            isZipping={isZipping}
            ffmpegLoading={ffmpegLoading}
            completedCount={completedCount}
            totalFiles={totalFiles}
            failedCount={failedCount}
            onStartConversion={startConversion}
            onCancelConversion={cancelConversion}
            onDownloadZip={downloadZipPart}
            activeTab={activeTab}
          />
        </aside>
      </main>

      {/* FOOTER */}
      <footer className="footer" id="app-footer">
        <p>
          <a 
            href="https://scarleterror.com/uexxx1dft?key=dac0ebf097004a1689b7f79a52dcf97e" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            @Yogaa 2026
          </a>
        </p>
      </footer>
    </>
  );
}
