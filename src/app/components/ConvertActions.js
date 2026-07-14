"use client";

import React from "react";

/**
 * Convert actions sidebar card.
 * Shows conversion status, start/cancel buttons, and ZIP download options.
 */
export default function ConvertActions({
  files,
  isConverting,
  isZipping,
  ffmpegLoading,
  completedCount,
  totalFiles,
  failedCount,
  onStartConversion,
  onCancelConversion,
  onDownloadZip,
  activeTab = "mkvtomp4",
}) {
  const hasCompleted = completedCount > 0;
  const isResizer = activeTab === "resizer";

  // Dynamic texts
  const titleText = isResizer ? "Resize" : "Convert";
  
  let helperText = "";
  if (files.length === 0) {
    helperText = isResizer ? "Add video files to begin resizing." : "Add MKV files to begin conversion.";
  } else if (isConverting) {
    helperText = isResizer 
      ? `Resizing... ${completedCount}/${totalFiles} selesai.` 
      : `Converting... ${completedCount}/${totalFiles} selesai.`;
  } else if (failedCount > 0) {
    helperText = isResizer
      ? `${failedCount} gagal. Klik resize untuk mencoba lagi.`
      : `${failedCount} gagal. Klik convert untuk mencoba lagi.`;
  } else if (completedCount === totalFiles) {
    helperText = isResizer
      ? `Semua ${totalFiles} file video berhasil di-resize.`
      : `Semua ${totalFiles} file berhasil dikonversi.`;
  } else {
    helperText = isResizer
      ? `Siap memproses ${files.length} file video.`
      : `Siap memproses ${files.length} file.`;
  }

  const startBtnText = ffmpegLoading
    ? "Loading FFmpeg..."
    : failedCount > 0
      ? "Retry Failed"
      : isResizer
        ? "Resize All Videos"
        : "Convert All to MP4";

  const cancelBtnText = isResizer ? "Cancel Resizing" : "Cancel Conversion";

  return (
    <div className="settings-card" id="process-actions">
      <h3 className="settings-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
        {titleText}
      </h3>
      <p className="field-helper">
        {helperText}
      </p>
      {!isConverting ? (
        <button
          className={`btn ${ffmpegLoading ? 'btn-skeleton' : 'btn-primary'}`}
          disabled={Boolean(ffmpegLoading || files.length === 0 || (completedCount === totalFiles && failedCount === 0 && totalFiles > 0))}
          suppressHydrationWarning
          id="btn-start-convert"
          type="button"
          onClick={onStartConversion}
        >
          {startBtnText}
        </button>
      ) : (
        <button
          className="btn btn-danger-outline"
          id="btn-cancel-convert"
          type="button"
          onClick={onCancelConversion}
        >
          {cancelBtnText}
        </button>
      )}
      {hasCompleted && !isConverting && completedCount > 1 && (
        <div className="zip-actions">
          {Math.ceil(completedCount / 20) === 1 ? (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => onDownloadZip(0, completedCount)}
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
                  onClick={() => onDownloadZip(start, end)}
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
  );
}
