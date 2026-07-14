"use client";

import { useState, useCallback, useRef } from "react";
import { getFFmpeg, convertFile, cancelAllConversions } from "@/lib/ffmpeg";
import { hexToAssColor } from "@/app/utils/helpers";

/**
 * Custom hook that encapsulates all FFmpeg conversion logic.
 * Separates conversion concerns from UI rendering.
 *
 * @param {Object} params
 * @param {Array} params.files - Current file list state
 * @param {Function} params.setFiles - State setter for file list
 * @param {Function} params.addToast - Toast notification function
 * @param {Object} params.hardsubConfig - Hardsub configuration object
 */
export function useFFmpegConverter({ files, setFiles, addToast, hardsubConfig }) {
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const cancelRef = useRef(false);

  const startConversion = useCallback(async () => {
    if (isConverting || files.length === 0) return;

    const queuedFiles = files.filter((f) => f.status === "queued" || f.status === "failed");
    if (queuedFiles.length === 0) {
      addToast("No files to convert (all completed or in progress)", "warning");
      return;
    }

    cancelRef.current = false;
    setIsConverting(true);

    // Load FFmpeg if not ready
    if (!ffmpegReady) {
      setFfmpegLoading(true);
      addToast("Loading FFmpeg engine... this may take a moment on first use", "info");
      try {
        await getFFmpeg();
        setFfmpegReady(true);
        addToast("FFmpeg engine loaded", "success");
      } catch (err) {
        console.error("FFmpeg load failed:", err);
        addToast("Failed to load FFmpeg engine. Check your connection and try again.", "error");
        setFfmpegLoading(false);
        setIsConverting(false);
        return;
      }
      setFfmpegLoading(false);
    }

    const ffmpeg = await getFFmpeg();
    let successCount = 0;
    let failCount = 0;

    // Process each queued/failed file sequentially
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;

      const f = files[i];
      if (f.status !== "queued" && f.status !== "failed") continue;

      const fileId = f.id;

      // Mark as converting
      setFiles((prev) =>
        prev.map((item) =>
          item.id === fileId
            ? { ...item, status: "converting", progress: 0, startTime: Date.now(), eta: null }
            : item
        )
      );

      try {
        const outputName = f.newName || f.name.replace(/\.mkv$/i, ".mp4");

        const hsOptions = {
          enabled: hardsubConfig.enabled,
          originalStyle: hardsubConfig.originalStyle,
          overrideFont: hardsubConfig.overrideFont,
          fontSize: hardsubConfig.fontSize,
          scale: hardsubConfig.scale,
          primaryColour: hexToAssColor(hardsubConfig.color),
        };

        const data = await convertFile(ffmpeg, f.file, outputName, (ratio) => {
          setFiles((prev) =>
            prev.map((item) => {
              if (item.id === fileId) {
                const progress = Math.round(ratio * 100);
                let eta = null;
                if (item.startTime && progress > 0 && progress < 100) {
                  const elapsed = Date.now() - item.startTime;
                  const totalEstimated = elapsed / (progress / 100);
                  eta = Math.round((totalEstimated - elapsed) / 1000);
                }
                return { ...item, progress, eta };
              }
              return item;
            })
          );
        }, hsOptions);

        if (cancelRef.current) break;

        // Buat File object dengan nama yang sesuai agar metadata penamaan tersimpan di browser
        const outputFileName = f.newName || f.name.replace(/\.mkv$/i, ".mp4");
        const fileObj = new File([data.buffer], outputFileName, { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(fileObj);

        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: "completed", progress: 100, data, blobUrl }
              : item
          )
        );
        successCount++;
      } catch (err) {
        console.error(`Conversion failed for ${f.name}:`, err);
        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: "failed", progress: 0 }
              : item
          )
        );
        failCount++;
      }
    }

    setIsConverting(false);

    if (cancelRef.current) {
      addToast("Conversion cancelled", "warning");
    } else if (failCount > 0 && successCount > 0) {
      addToast(`Done: ${successCount} converted, ${failCount} failed`, "warning");
    } else if (failCount > 0) {
      addToast(`Conversion failed for ${failCount} file${failCount > 1 ? "s" : ""}`, "error");
    } else if (successCount > 0) {
      addToast(`All ${successCount} file${successCount > 1 ? "s" : ""} converted successfully`, "success");
    }
  }, [
    files,
    isConverting,
    ffmpegReady,
    addToast,
    setFiles,
    hardsubConfig,
  ]);

  const cancelConversion = useCallback(async () => {
    cancelRef.current = true;
    
    // Terminate worker secara paksa agar proses yang sedang berjalan langsung berhenti
    await cancelAllConversions();
    
    // Reset status file yang sedang converting kembali ke queued
    setFiles((prev) =>
      prev.map((item) =>
        item.status === "converting"
          ? { ...item, status: "queued", progress: 0, eta: null }
          : item
      )
    );
    
    setIsConverting(false);
    setFfmpegReady(false); // Worker baru perlu di-init ulang
    addToast("Conversion cancelled", "warning");
  }, [setFiles, addToast]);

  return {
    ffmpegReady,
    ffmpegLoading,
    isConverting,
    startConversion,
    cancelConversion,
  };
}
