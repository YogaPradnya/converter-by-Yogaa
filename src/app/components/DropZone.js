"use client";

import React, { useRef, useCallback } from "react";

/**
 * Drag-and-drop file upload zone.
 * Accepts only .mkv files.
 */
export default function DropZone({ onFilesAdded, dragOver, onDragOver, onDragLeave, onDrop }) {
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
          openFilePicker();
        }}
      >
        Select Files
      </button>
    </div>
  );
}
