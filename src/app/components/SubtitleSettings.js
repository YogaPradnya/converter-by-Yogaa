"use client";

import React from "react";

/**
 * Subtitle/hardsub settings sidebar card.
 * Controls hardsub toggle, original style preservation, font override, and custom styling.
 */
export default function SubtitleSettings({
  hardsubEnabled,
  onHardsubToggle,
  hardsubOriginalStyle,
  onOriginalStyleToggle,
  hardsubOverrideFont,
  onOverrideFontToggle,
  hardsubFontSize,
  onFontSizeChange,
  hardsubScale,
  onScaleChange,
  hardsubColor,
  onColorChange,
}) {
  return (
    <div className="settings-card" id="subtitle-settings">
      <h3 className="settings-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Subtitle Settings
      </h3>

      <div className="settings-section">
        <label className="toggle-wrapper">
          <span className={`toggle-label ${hardsubEnabled ? "hardsub-warn-label" : ""}`}>
            Enable Hardsub (Lambat)
          </span>
          <input
            type="checkbox"
            className="toggle-input"
            checked={hardsubEnabled}
            onChange={(e) => onHardsubToggle(e.target.checked)}
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
        <div className="hardsub-options">
          <div className="hardsub-section hardsub-section-bordered">
            <label className="hardsub-checkbox-wrapper">
              <input
                type="checkbox"
                className="hardsub-checkbox"
                checked={hardsubOriginalStyle}
                onChange={(e) => onOriginalStyleToggle(e.target.checked)}
              />
              <span className="hardsub-label">
                Pertahankan Gaya Asli Subtitle (Anime)
              </span>
            </label>
            <span className="field-helper">
              Centang agar posisi, font, & lirik (Karaoke) tidak rusak saat di-hardsub.
            </span>
          </div>

          <div className={`hardsub-section ${!hardsubOriginalStyle ? "hardsub-section-bordered" : ""}`}>
            <label className="hardsub-checkbox-wrapper">
              <input
                type="checkbox"
                className="hardsub-checkbox"
                checked={hardsubOverrideFont}
                onChange={(e) => onOverrideFontToggle(e.target.checked)}
              />
              <span className="hardsub-label">
                Gunakan Font Poppins
              </span>
            </label>
            <span className="field-helper">
              Paksa semua subtitle menggunakan font Poppins.
            </span>
          </div>

          {!hardsubOriginalStyle && (
            <>
              <div className="hardsub-section">
                <label className="settings-label">Ukuran Font</label>
                <input
                  type="number"
                  className="input-text"
                  value={hardsubFontSize}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  min="10"
                  max="100"
                />
              </div>

              <div className="hardsub-section">
                <label className="settings-label">Skala (%)</label>
                <input
                  type="number"
                  className="input-text"
                  value={hardsubScale}
                  onChange={(e) => onScaleChange(Number(e.target.value))}
                  min="10"
                  max="200"
                />
              </div>

              <div className="hardsub-section">
                <label className="settings-label">Warna Teks</label>
                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    className="color-picker-input"
                    value={hardsubColor}
                    onChange={(e) => onColorChange(e.target.value)}
                  />
                  <span className="color-picker-value">{hardsubColor.toUpperCase()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
