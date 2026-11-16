import { createFileRoute } from "@tanstack/react-router";
import { keepAliveConfig as config } from "@/config/keep-alive-config";
import {
  determineAction,
  fallbackTouchQrRecords,
  fetchOtherEndpoints,
  getKeepAliveClient,
  querySupabaseRandom,
} from "@/lib/keep-alive-helper";

export const Route = createFileRoute("/api/keep-alive")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = getKeepAliveClient();
        const logs: string[] = [];
        let ok = true;
        let keepAliveRan = false;

        // Step 1: Query and/or insert/delete on keep_alive table
        try {
          if (!config.disableRandomStringQuery) {
            const res = await querySupabaseRandom(supabase);
            logs.push(res.message);
            if (!res.successful) {
              ok = false;
            } else {
              keepAliveRan = true;
            }
          }

          if (config.allowInsertionAndDeletion) {
            const actionRes = await determineAction(supabase);
            logs.push(actionRes.message);
            if (!actionRes.successful) {
              ok = false;
            } else {
              keepAliveRan = true;
            }
          }
        } catch (err) {
          logs.push(`keep_alive table check error: ${err instanceof Error ? err.message : String(err)}`);
          ok = false;
        }

        // Step 2: Fallback touch against qr_records to guarantee Supabase is active
        if (!keepAliveRan) {
          try {
            const fallbackRes = await fallbackTouchQrRecords(supabase);
            logs.push(fallbackRes.message);
            if (fallbackRes.successful) {
              ok = true; // Fallback successfully touched the database
            }
          } catch (err) {
            logs.push(`Fallback query error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // Step 3: Daisy-chain any external endpoints (if configured)
        if (config.otherEndpoints && config.otherEndpoints.length > 0) {
          const others = await fetchOtherEndpoints();
          logs.push(`Other endpoints:\n${others.join("\n")}`);
        }

        const body = {
          status: ok ? "ok" : "warning",
          timestamp: new Date().toISOString(),
          message: ok
            ? "Supabase keep-alive executed successfully. Project inactivity timer reset."
            : "Supabase keep-alive executed with warnings.",
          details: logs,
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: ok ? 200 : 207,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      },
    },
  },
});

