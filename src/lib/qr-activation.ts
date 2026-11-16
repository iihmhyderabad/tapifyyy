import { z } from "zod";

export const activationLinkSchema = z.string().trim().min(1, "Add your link to activate this card.")
  .max(4096, "This link is too long.")
  .url("Enter a valid URL starting with https:// or http://.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use an http:// or https:// website link without login details.");

export function scanState(record: { destination_url: string | null; is_active: boolean }) {
  if (!record.destination_url?.trim()) return "activation";
  return record.is_active ? "redirect" : "inactive";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function activationPage(qrCode: string, stylesheet: string, error = "", value = "", status = 200) {
  const title = `Activate ${qrCode} — Dynamic QR Manager`;
  const description = "Activate your QR/NFC card with your Google Review or website link.";
  return new Response(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website"><meta name="twitter:card" content="summary">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="${escapeHtml(stylesheet)}">
</head><body>
<main class="flex min-h-svh items-center justify-center bg-background px-5 py-10">
<div class="w-full max-w-sm">
<div class="mb-6 text-gold-deep" aria-hidden="true"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v6h-6v-2"/></svg></div>
<h1 class="font-display text-3xl font-bold text-foreground">Activate Your QR</h1>
<p class="mt-3 text-sm text-muted-foreground">Card/QR ID</p>
<p class="mt-1 break-all text-lg font-semibold text-foreground">${escapeHtml(qrCode)}</p>
<form method="post" action="/r/${encodeURIComponent(qrCode)}" class="mt-8">
<label for="destination" class="field-label">Add Your Link</label>
<input id="destination" name="destination" type="url" required maxlength="4096" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" placeholder="https://g.page/r/your-review-link" value="${escapeHtml(value)}" class="field-input min-h-12 text-base" aria-describedby="link-hint${error ? " link-error" : ""}" ${error ? 'aria-invalid="true"' : ""}>
<p id="link-hint" class="mt-2 text-sm text-muted-foreground">Paste any Google Review or website URL.</p>
${error ? `<p id="link-error" role="alert" class="mt-3 text-sm text-destructive">${escapeHtml(error)}</p>` : ""}
<button type="submit" class="btn-gold mt-6 min-h-12 w-full text-base">Activate QR</button>
</form>
</div></main>
</body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}