let nextFileId = 1;

/**
 * Generate a unique ID for each file entry.
 */
export function generateId() {
  return `file-${nextFileId++}`;
}

/**
 * Apply rename template to a filename.
 * Supports tokens: {original}, {index}, {date}, {time}
 */
export function applyTemplate(template, originalName, index, startNum) {
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

/**
 * Convert HEX color to ASS subtitle color format.
 * ASS uses &HBBGGRR format (reversed order, no alpha).
 */
export function hexToAssColor(hex) {
  const r = hex.substring(1, 3);
  const g = hex.substring(3, 5);
  const b = hex.substring(5, 7);
  return `&H00${b}${g}${r}`;
}
