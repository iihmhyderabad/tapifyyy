export type CardExportFormat = "pdf" | "svg" | "psd" | "png";

export const CARD_PRINT_INCHES = 4;
export const PSD_EXPORT_PIXELS = 2400;
export const PSD_PRINT_DPI = PSD_EXPORT_PIXELS / CARD_PRINT_INCHES;
export const cardExportFormats: { format: CardExportFormat; label: string }[] = [
  { format: "pdf", label: "PDF" },
  { format: "svg", label: "CorelDRAW/SVG" },
  { format: "psd", label: "PSD" },
  { format: "png", label: "PNG · 8K" },
];