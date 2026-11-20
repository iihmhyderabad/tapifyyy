import { useState, useRef, useMemo, useEffect } from "react";
import { toPng } from "html-to-image";
import { zipSync } from "fflate";
import { toast } from "sonner";
import {
  Download,
  FileArchive,
  FileText,
  QrCode,
  Loader2,
  X,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveCardBlob } from "@/lib/card-export";
import { permanentUrl, qrPngDataUrl } from "@/lib/qr";
import type { QrRecord } from "@/data/qr-queries";
import { MasterNfcCard } from "@/components/master-nfc-card";
import { DesignCard } from "@/components/design-card";

export type BulkExportFormat = "png-zip" | "pdf-multipage" | "qr-zip";

export interface BulkCardDownloadModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  records: QrRecord[];
  cardType?: "master-nfc" | "google-design" | "instagram-design";
  getCardElement?: (record: QrRecord) => HTMLElement | null;
}

export function extractCardNumber(qrCode: string, fallbackIndex: number): number {
  const match = qrCode.match(/(\d+)$/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) return num;
  }
  return fallbackIndex + 1;
}

export function BulkCardDownloadModal({
  open,
  onClose,
  title,
  records,
  cardType = "master-nfc",
  getCardElement,
}: BulkCardDownloadModalProps) {
  const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
  const [startNum, setStartNum] = useState<number>(1);
  const [endNum, setEndNum] = useState<number>(50);
  const [format, setFormat] = useState<BulkExportFormat>("png-zip");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; cardCode: string }>({
    current: 0,
    total: 0,
    cardCode: "",
  });
  const [stagingRecord, setStagingRecord] = useState<QrRecord | null>(null);

  const stagingRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef(false);

  // Calculate card bounds
  const { minNum, maxNum, totalCards } = useMemo(() => {
    if (!records || records.length === 0) return { minNum: 1, maxNum: 1, totalCards: 0 };
    const nums = records.map((r, i) => extractCardNumber(r.qr_code, i));
    return {
      minNum: Math.min(...nums),
      maxNum: Math.max(...nums),
      totalCards: records.length,
    };
  }, [records]);

  // Set initial range once records are loaded
  useEffect(() => {
    if (records.length > 0) {
      setStartNum(minNum);
      setEndNum(Math.min(minNum + 49, maxNum));
    }
  }, [minNum, maxNum, records.length]);

  // Filter selected records based on range
  const selectedRecords = useMemo(() => {
    if (rangeMode === "all") return records;
    const s = Math.min(startNum, endNum);
    const e = Math.max(startNum, endNum);
    return records.filter((r, i) => {
      const n = extractCardNumber(r.qr_code, i);
      return n >= s && n <= e;
    });
  }, [records, rangeMode, startNum, endNum]);

  // Generate convenient preset ranges
  const presets = useMemo(() => {
    const list: Array<{ label: string; start: number; end: number }> = [];
    if (totalCards <= 50) {
      list.push({ label: `All ${totalCards}`, start: minNum, end: maxNum });
      return list;
    }

    const step = 50;
    for (let s = minNum; s <= maxNum; s += step) {
      const e = Math.min(s + step - 1, maxNum);
      list.push({ label: `${s} – ${e}`, start: s, end: e });
      if (list.length >= 8) break;
    }
    return list;
  }, [minNum, maxNum, totalCards]);

  const handlePresetClick = (s: number, e: number) => {
    setRangeMode("custom");
    setStartNum(s);
    setEndNum(e);
  };

  const captureCardPng = async (record: QrRecord): Promise<string> => {
    // 1. Try to get existing mounted DOM element
    let el = getCardElement ? getCardElement(record) : null;

    // 2. If not found in DOM, use off-screen staging container
    if (!el && stagingRef.current) {
      setStagingRecord(record);
      // Wait for React re-render and fonts/images
      await new Promise((r) => setTimeout(r, 40));
      await document.fonts.ready;
      el = stagingRef.current.firstElementChild as HTMLElement;
    }

    if (!el) {
      throw new Error(`Card element unavailable for ${record.qr_code}`);
    }

    return await toPng(el, {
      pixelRatio: 3.125, // ~1200x1200px (300 DPI for 4x4 inch cards)
      backgroundColor: "#ffffff",
      cacheBust: false,
    });
  };

  const handleStartDownload = async () => {
    if (selectedRecords.length === 0) {
      toast.error("No cards match the selected range.");
      return;
    }

    setIsProcessing(true);
    cancelRef.current = false;
    setProgress({ current: 0, total: selectedRecords.length, cardCode: "" });

    const total = selectedRecords.length;
    const prefix = selectedRecords[0]?.qr_code.split("-")[0] || "CARD";
    const rangeLabel =
      rangeMode === "all"
        ? `all-${total}`
        : `${startNum}-to-${endNum}`;

    try {
      if (format === "qr-zip") {
        // Fast QR-only ZIP export
        const files: Record<string, Uint8Array> = {};
        for (let i = 0; i < total; i++) {
          if (cancelRef.current) {
            toast.info("Download cancelled.");
            return;
          }
          const rec = selectedRecords[i];
          setProgress({ current: i + 1, total, cardCode: rec.qr_code });

          const qrUrl = permanentUrl(rec.qr_code);
          const dataUrl = await qrPngDataUrl(qrUrl, 1024);
          const base64 = dataUrl.split(",")[1] || "";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);

          files[`${rec.qr_code}-qr.png`] = bytes;
          await new Promise((r) => setTimeout(r, 5));
        }

        const zipData = zipSync(files);
        const zipBlob = new Blob([zipData], { type: "application/zip" });
        saveCardBlob(zipBlob, `${prefix}-${rangeLabel}-qr-codes.zip`);
        toast.success(`Exported ${total} QR codes in ZIP archive!`);
      } else if (format === "pdf-multipage") {
        // Multi-page Print-Ready PDF (4x4 inches = 288x288 pt per page)
        const { jsPDF } = await import("jspdf");
        const points = 288; // 4 inches * 72 points/inch
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: [points, points],
          compress: true,
        });

        for (let i = 0; i < total; i++) {
          if (cancelRef.current) {
            toast.info("Download cancelled.");
            return;
          }
          const rec = selectedRecords[i];
          setProgress({ current: i + 1, total, cardCode: rec.qr_code });

          const dataUrl = await captureCardPng(rec);
          if (i > 0) {
            pdf.addPage([points, points], "portrait");
          }
          pdf.addImage(dataUrl, "PNG", 0, 0, points, points);
          await new Promise((r) => setTimeout(r, 10));
        }

        const pdfBlob = pdf.output("blob");
        saveCardBlob(pdfBlob, `${prefix}-${rangeLabel}-print-cards.pdf`);
        toast.success(`Exported ${total} cards as multi-page print PDF!`);
      } else {
        // High-res Card PNGs ZIP Archive
        const files: Record<string, Uint8Array> = {};
        for (let i = 0; i < total; i++) {
          if (cancelRef.current) {
            toast.info("Download cancelled.");
            return;
          }
          const rec = selectedRecords[i];
          setProgress({ current: i + 1, total, cardCode: rec.qr_code });

          const dataUrl = await captureCardPng(rec);
          const base64 = dataUrl.split(",")[1] || "";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);

          files[`${rec.qr_code}-card.png`] = bytes;
          // Yield to let browser render progress bar and maintain responsiveness
          await new Promise((r) => setTimeout(r, 10));
        }

        const zipData = zipSync(files);
        const zipBlob = new Blob([zipData], { type: "application/zip" });
        saveCardBlob(zipBlob, `${prefix}-${rangeLabel}-cards.zip`);
        toast.success(`Exported ${total} cards in ZIP archive!`);
      }

      onClose();
    } catch (err) {
      console.error("Bulk export error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate bulk cards");
    } finally {
      setIsProcessing(false);
      setStagingRecord(null);
    }
  };

  const handleCancel = () => {
    if (isProcessing) {
      cancelRef.current = true;
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
        aria-hidden
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <h2 className="font-display text-xl font-bold text-foreground">
                Download Cards in Bulk / Range
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {title} · Export batches or all {totalCards} cards in high-res format
            </p>
          </div>
          {!isProcessing && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-5">
          {/* 1. Range Mode Selector */}
          <div>
            <label className="field-label text-xs uppercase tracking-wider text-muted-foreground">
              1. Select Card Scope
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRangeMode("all")}
                className={`rounded-xl border p-3 text-left transition-all ${
                  rangeMode === "all"
                    ? "border-gold bg-gold/10 text-foreground ring-1 ring-gold"
                    : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <div className="font-semibold text-sm">All Cards</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Export all {totalCards} cards ({minNum} → {maxNum})
                </div>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRangeMode("custom")}
                className={`rounded-xl border p-3 text-left transition-all ${
                  rangeMode === "custom"
                    ? "border-gold bg-gold/10 text-foreground ring-1 ring-gold"
                    : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <div className="font-semibold text-sm">Custom Range</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Choose start & end batch numbers
                </div>
              </button>
            </div>
          </div>

          {/* 2. Custom Range Inputs & Presets (if custom mode selected) */}
          {rangeMode === "custom" && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-foreground">
                <span>Range Interval</span>
                <span className="text-muted-foreground">Available: {minNum} to {maxNum}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="bulk-start-num">
                    From Card #
                  </label>
                  <input
                    id="bulk-start-num"
                    type="number"
                    min={minNum}
                    max={maxNum}
                    disabled={isProcessing}
                    value={startNum}
                    onChange={(e) => setStartNum(Math.max(minNum, parseInt(e.target.value) || minNum))}
                    className="field-input mt-1 text-center font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="bulk-end-num">
                    To Card #
                  </label>
                  <input
                    id="bulk-end-num"
                    type="number"
                    min={minNum}
                    max={maxNum}
                    disabled={isProcessing}
                    value={endNum}
                    onChange={(e) => setEndNum(Math.min(maxNum, parseInt(e.target.value) || minNum))}
                    className="field-input mt-1 text-center font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                  Quick Range Batches:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handlePresetClick(p.start, p.end)}
                      className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                        startNum === p.start && endNum === p.end
                          ? "border-gold bg-gold text-primary-foreground font-semibold"
                          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Range Summary Pill */}
          <div className="flex items-center justify-between rounded-xl bg-secondary/80 px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">Selected for download:</span>
            <span className="font-semibold text-foreground">
              {selectedRecords.length} cards{" "}
              {selectedRecords.length > 0 && (
                <span className="font-mono text-gold">
                  ({selectedRecords[0]?.qr_code} → {selectedRecords[selectedRecords.length - 1]?.qr_code})
                </span>
              )}
            </span>
          </div>

          {/* 3. Export Format Selector */}
          <div>
            <label className="field-label text-xs uppercase tracking-wider text-muted-foreground">
              2. Download Format
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setFormat("png-zip")}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                  format === "png-zip"
                    ? "border-gold bg-gold/10 text-foreground ring-1 ring-gold font-semibold"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <FileArchive className="h-5 w-5 mb-1.5 text-gold" />
                <span className="text-xs">ZIP of PNGs</span>
                <span className="text-[10px] text-muted-foreground">1200×1200px (300 DPI)</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setFormat("pdf-multipage")}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                  format === "pdf-multipage"
                    ? "border-gold bg-gold/10 text-foreground ring-1 ring-gold font-semibold"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <FileText className="h-5 w-5 mb-1.5 text-gold" />
                <span className="text-xs">Multi-Page PDF</span>
                <span className="text-[10px] text-muted-foreground">Print-ready 4×4 in</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setFormat("qr-zip")}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                  format === "qr-zip"
                    ? "border-gold bg-gold/10 text-foreground ring-1 ring-gold font-semibold"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <QrCode className="h-5 w-5 mb-1.5 text-gold" />
                <span className="text-xs">QR Codes Only</span>
                <span className="text-[10px] text-muted-foreground">ZIP of 1024px PNGs</span>
              </button>
            </div>
          </div>

          {/* Progress Bar (when active) */}
          {isProcessing && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                  Processing {progress.cardCode}...
                </span>
                <span className="font-mono font-semibold text-gold">{percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gold transition-all duration-150 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Generated {progress.current} of {progress.total} cards · Please keep this tab open
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing && !cancelRef.current}
              onClick={handleCancel}
              className="btn-outline text-xs"
            >
              {isProcessing ? "Cancel Export" : "Cancel"}
            </Button>
            <Button
              type="button"
              disabled={isProcessing || selectedRecords.length === 0}
              onClick={handleStartDownload}
              className="btn-gold text-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download {selectedRecords.length} Cards
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden Staging Container for Off-Screen Rendering */}
      <div
        ref={stagingRef}
        aria-hidden
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: "384px",
          height: cardType === "master-nfc" ? "384px" : "530px",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        {stagingRecord && (
          cardType === "instagram-design" ? (
            <DesignCard design="instagram" code={stagingRecord.qr_code} url={permanentUrl(stagingRecord.qr_code)} />
          ) : cardType === "google-design" ? (
            <DesignCard design="google" code={stagingRecord.qr_code} url={permanentUrl(stagingRecord.qr_code)} />
          ) : (
            <MasterNfcCard code={stagingRecord.qr_code} url={permanentUrl(stagingRecord.qr_code)} />
          )
        )}
      </div>
    </div>
  );
}
