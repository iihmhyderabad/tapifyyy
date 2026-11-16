/** Stable public site every printed QR points to.
 * Set VITE_PUBLIC_SITE_URL to your production domain (e.g. https://yourdomain.com or https://your-project.vercel.app). */
export const PUBLIC_SITE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_SITE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_PUBLIC_SITE_URL) ||
  "https://nfcqr.vercel.app";
