"use client";

import React, { useRef, useCallback } from "react";

/**
 * Drag-and-drop file upload zone.
 * Accepts only .mkv files.
 */
export default function DropZone({ onFilesAdded, dragOver, onDragOver, onDragLeave, onDrop, activeTab = "mkvtomp4" }) {
  const fileInputRef = useRef(null);

  const handleFileInput = useCallback(
    (e) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesAdded(e.target.files);
        e.target.value = "";
      }
    },
    [onFilesAdded]
  );

  const openFilePicker = () => fileInputRef.current?.click();

  const isResizer = activeTab === "resizer";
  const acceptString = isResizer 
    ? ".mkv,.mp4,.webm,.avi,.mov,.m4v,.flv,video/*" 
    : ".mkv,video/x-matroska";

  const zoneTitle = isResizer 
    ? "Drag & Drop video files here" 
    : "Drag & Drop MKV files here";

  const zoneSubtitle = isResizer 
    ? "or click to browse. MP4, MKV, WebM, AVI, etc. accepted. Off-line client-side resizing."
    : "or click to browse. Only .mkv files accepted. All processing happens offline in your browser.";

  return (
    <div
      className={`dropzone${dragOver ? " dragover" : ""}`}
      id="drop-zone"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={openFilePicker}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFilePicker();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptString}
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
        <div className="dropzone-title">{zoneTitle}</div>
        <div className="dropzone-subtitle">
          {zoneSubtitle}
        </div>
      </div>
      <button
        className="btn btn-secondary"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openFilePicker();
        }}
      >
        Select Files
      </button>
    </div>
  );
}
