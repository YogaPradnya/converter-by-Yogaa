"use client";

import React from "react";

/**
 * Single file row in the queue list.
 */
function FileRow({
  file,
  index,
  onDownload,
  onRemove,
  isConverting,
  isDragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
}) {
  return (
    <div
      className={`file-row ${isDragging ? "dragging" : ""}`}
      id={`file-row-${file.id}`}
      draggable={!isConverting}
      onDragStart={(e) => onDragStart(index, e)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="file-icon drag-handle" style={{ cursor: isConverting ? "default" : "grab" }} title="Drag to reorder">
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
              className={`file-progress-bar${file.status === "converting" ? " progress-active" : ""}`}
              style={{ width: `${file.progress}%` }}
            />
          </div>
        )}
      </div>
      <div className="file-actions">
        {file.status === "completed" && (file.blobUrl || file.data) && (
          <a
            href={file.blobUrl ? `${file.blobUrl}#filename=${encodeURIComponent(file.newName || file.name.replace(/\.mkv$/i, ".mp4"))}` : "#"}
            download={file.newName || file.name.replace(/\.mkv$/i, ".mp4")}
            onClick={(e) => {
              if (!file.blobUrl && file.data) {
                e.preventDefault();
                onDownload(file);
              }
            }}
            className="btn-icon"
            title="Download"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "inherit" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
          </a>
        )}
        <button
          className="btn-icon btn-icon-danger"
          title="Remove file"
          onClick={() => onRemove(file.id)}
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
  );
}

/**
 * File queue list with header actions (ZIP download, clear all).
 */
export default function FileList({
  files,
  isConverting,
  isZipping,
  onRemoveFile,
  onDownloadFile,
  onDownloadZip,
  onClearFiles,
  onReorder,
}) {
  const [draggedIndex, setDraggedIndex] = React.useState(null);

  const totalFiles = files.length;
  const completedCount = files.filter((f) => f.status === "completed").length;
  const hasCompleted = completedCount > 0;

  return (
    <div className="card" id="file-list-card">
      <div className="panel-header">
        <h3>Queue {totalFiles > 0 && <span className="queue-count">{totalFiles}</span>}</h3>
        <div style={{ display: "flex", gap: "4px" }}>
          {hasCompleted && completedCount > 1 && (
            <button
              className="btn-icon"
              title={completedCount > 20 ? "Unduh ZIP bagian 1" : "Download all as ZIP"}
              onClick={() => onDownloadZip(0, Math.min(20, completedCount))}
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
            onClick={onClearFiles}
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
          {files.map((file, index) => (
            <FileRow
              key={file.id}
              file={file}
              index={index}
              onDownload={onDownloadFile}
              onRemove={onRemoveFile}
              isConverting={isConverting}
              isDragging={draggedIndex === index}
              onDragStart={(idx, e) => {
                if (isConverting) {
                  e.preventDefault();
                  return;
                }
                setDraggedIndex(idx);
                e.dataTransfer.effectAllowed = "move";
                // Invisible data payload
                e.dataTransfer.setData("text/plain", idx);
              }}
              onDragEnter={(idx) => {
                if (draggedIndex === null || draggedIndex === idx || isConverting) return;
                onReorder(draggedIndex, idx);
                setDraggedIndex(idx);
              }}
              onDragEnd={() => setDraggedIndex(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
