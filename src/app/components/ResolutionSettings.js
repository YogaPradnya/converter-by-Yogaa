"use client";

import React from "react";

/**
 * Resolution settings sidebar card.
 * Controls target video resolution.
 */
export default function ResolutionSettings({
  resolution,
  onResolutionChange,
}) {
  const resolutions = [
    { value: "original", label: "Original (No Scale)" },
    { value: "1080p", label: "1080p (Full HD)" },
    { value: "720p", label: "720p (HD)" },
    { value: "480p", label: "480p (SD)" },
    { value: "360p", label: "360p (Low)" },
  ];

  return (
    <div className="settings-card" id="resolution-settings">
      <h3 className="settings-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        Resolution Settings
      </h3>

      <div className="settings-section">
        <label className="settings-label" htmlFor="resolution-select">Target Resolution</label>
        <select
          id="resolution-select"
          className="input-text"
          value={resolution}
          onChange={(e) => onResolutionChange(e.target.value)}
          style={{ width: "100%", padding: "var(--sp-xs) var(--sp-sm)", cursor: "pointer" }}
        >
          {resolutions.map((res) => (
            <option key={res.value} value={res.value}>
              {res.label}
            </option>
          ))}
        </select>
        <span className="field-helper">
          Mengubah resolusi video. Jika selain <b>Original</b>, video akan di-encode ulang untuk menyesuaikan piksel.
        </span>
      </div>
    </div>
  );
}
