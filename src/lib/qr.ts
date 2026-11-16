import QRCode from "qrcode";
import { PUBLIC_SITE_URL } from "./qr-base";

/** The permanent URL a QR code encodes — never changes once printed. */
export function permanentUrl(qrCode: string): string {
  return `${PUBLIC_SITE_URL}/r/${encodeURIComponent(qrCode)}`;
}

/** Returns an error message, or null when the value is acceptable. Empty = awaiting. */
export function validateDestinationUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Only http:// or https:// links are allowed.";
    }
    return null;
  } catch {
    return "Enter a valid URL, for example https://g.page/r/your-review-link";
  }
}

/** Trimmed value for storage; empty string becomes NULL (awaiting destination). */
export function sanitizeDestination(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

/** High-resolution PNG data URL with a wide quiet zone on white. */
export async function qrPngDataUrl(value: string, size = 1024): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

/** Genuine scannable QR as SVG markup with a wide quiet zone on white. */
export async function qrSvgMarkup(value: string): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    margin: 4,
    errorCorrectionLevel: "H",
    width: 1024,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadText(text: string, mime: string, filename: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
