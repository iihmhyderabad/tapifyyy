import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import appCss from "../../styles.css?url";
import { activationLinkSchema, activationPage, scanState } from "@/lib/qr-activation";

/**
 * Public scan endpoint: /r/GREV-001 … /r/GREV-010
 *
 * Scanners (phones, NFC taps) hit this URL. It resolves the record in the
 * database and 302-redirects to the CURRENT destination, so printed QR codes
 * never change even when the destination does.
 */

function getPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "";
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    // Opaque sb_ keys aren't JWTs; send only apikey, not the default bearer.
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function brandedPage(
  title: string,
  heading: string,
  message: string,
  status: number,
): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Dynamic QR Manager</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #faf8f2;
    font-family: Georgia, 'Times New Roman', serif;
    color: #1c1a16;
    padding: 24px;
  }
  .card {
    max-width: 380px;
    width: 100%;
    background: #fff;
    border: 1px solid #e8e2d4;
    border-radius: 20px;
    padding: 40px 32px;
    text-align: center;
    box-shadow: 0 12px 40px -18px rgba(28, 26, 22, 0.25);
  }
  .mark {
    width: 44px; height: 44px; margin: 0 auto 18px;
    border-radius: 10px;
    background: #c9a227;
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: bold;
  }
  h1 { font-size: 22px; margin-bottom: 10px; }
  p { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #6d675c; }
  .rule { height: 2px; width: 56px; margin: 18px auto; background: #c9a227; border-radius: 2px; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">Q</div>
    <h1>${heading}</h1>
    <div class="rule"></div>
    <p>${message}</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/r/$qrCode")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const qrCode = decodeURIComponent(params.qrCode).trim().toUpperCase();
        const supabasePublic = getPublicClient();

        const { data, error } = await supabasePublic
          .from("qr_records")
          .select("qr_code, destination_url, is_active")
          .eq("qr_code", qrCode)
          .maybeSingle();

        if (error || !data) {
          return brandedPage(
            "QR code not found",
            "QR code not found",
            "This card is not registered in the system. Please contact the business that issued it.",
            404,
          );
        }

        // Count the scan (best-effort; a failed count must not block the redirect).
        try {
          await supabasePublic.rpc("record_scan", { _qr_code: qrCode });
        } catch {
          // ignore
        }

        if (scanState(data) === "activation") {
          return activationPage(qrCode, appCss);
        }

        if (!data.is_active) {
          return brandedPage(
            "QR code inactive",
            "This QR code is currently inactive",
            "The business has temporarily disabled this card. Please check back later.",
            200,
          );
        }

        const destination = data.destination_url;
        if (!destination || !/^https?:\/\//i.test(destination)) {
          return brandedPage(
            "QR not configured",
            "This QR code is not configured yet",
            "The saved destination link is not a valid web address.",
            200,
          );
        }

        return new Response(null, {
          status: 302,
          headers: { Location: destination, "Cache-Control": "no-store" },
        });
      },
      POST: async ({ request, params }) => {
        const qrCode = params.qrCode.trim().toUpperCase();
        // This flow is intentionally public. Only blank cards may be activated,
        // and the conditional UPDATE prevents overwriting a concurrent activation.
        // Compare browser fetch metadata rather than the proxy's internal URL:
        // the public hostname can differ from request.url behind hosting.
        if (request.headers.get("sec-fetch-site") === "cross-site") {
          return activationPage(qrCode, appCss, "Please activate this card from its QR link.", "", 403);
        }
        if (Number(request.headers.get("content-length")) > 16384) {
          return activationPage(qrCode, appCss, "This link is too long.", "", 413);
        }
        let value: unknown;
        try {
          value = (await request.formData()).get("destination");
        } catch {
          return activationPage(qrCode, appCss, "Please enter a valid website link.", "", 400);
        }
        const parsed = activationLinkSchema.safeParse(value);
        if (!parsed.success) {
          return activationPage(qrCode, appCss, parsed.error.issues[0]?.message ?? "Enter a valid link.", typeof value === "string" ? value.slice(0, 4096) : "", 400);
        }
        const supabasePublic = getPublicClient();
        const { data, error } = await supabasePublic.from("qr_records")
          .update({ destination_url: parsed.data, is_active: true })
          .eq("qr_code", qrCode)
          .or("destination_url.is.null,destination_url.eq.")
          .select("qr_code")
          .maybeSingle();
        if (error) {
          return activationPage(qrCode, appCss, "Activation could not be saved. Please try again.", parsed.data, 503);
        }
        if (!data) {
          const { data: existing, error: readError } = await supabasePublic.from("qr_records")
            .select("qr_code, destination_url").eq("qr_code", qrCode).maybeSingle();
          if (readError) return activationPage(qrCode, appCss, "Please try again in a moment.", parsed.data, 503);
          if (!existing) return brandedPage("QR code not found", "QR code not found", "This card is not registered in the system.", 404);
        }
        // Return through the permanent scan URL so subsequent scans always use
        // the saved destination; do not cache a permanent HTTP redirect.
        return new Response(null, { status: 303, headers: { Location: `/r/${encodeURIComponent(qrCode)}`, "Cache-Control": "no-store" } });
      },
    },
  },
});
