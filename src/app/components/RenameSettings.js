"use client";

import React from "react";

/**
 * Rename settings sidebar card.
 * Controls auto-rename toggle, template format, starting index.
 */
export default function RenameSettings({
  autoRenameEnabled,
  onAutoRenameToggle,
  renameFormat,
  onRenameFormatChange,
  customStartNumber,
  onStartNumberChange,
  onApplyBatchRename,
  filesCount,
}) {
  const addToken = (token) => {
    onRenameFormatChange(renameFormat + token);
  };

  return (
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
            onChange={(e) => onAutoRenameToggle(e.target.checked)}
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
          onChange={(e) => onRenameFormatChange(e.target.value)}
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
          onChange={(e) => onStartNumberChange(parseInt(e.target.value) || 1)}
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
        disabled={Boolean(!autoRenameEnabled || filesCount === 0)}
        suppressHydrationWarning
        id="btn-apply-rename"
        type="button"
        onClick={onApplyBatchRename}
      >
        Apply Batch Rename
      </button>
    </div>
  );
}
