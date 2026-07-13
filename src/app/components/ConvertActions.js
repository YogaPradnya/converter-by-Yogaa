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
}) {
  const hasCompleted = completedCount > 0;

  return (
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
          className={`btn ${ffmpegLoading ? 'btn-skeleton' : 'btn-primary'}`}
          disabled={Boolean(ffmpegLoading || files.length === 0 || (completedCount === totalFiles && failedCount === 0 && totalFiles > 0))}
          suppressHydrationWarning
          id="btn-start-convert"
          type="button"
          onClick={onStartConversion}
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
          onClick={onCancelConversion}
        >
          Cancel Conversion
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
