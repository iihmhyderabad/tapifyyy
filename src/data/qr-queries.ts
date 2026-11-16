import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type QrRecord = Database["public"]["Tables"]["qr_records"]["Row"];

export const qrRecordsQueryOptions = queryOptions({
  queryKey: ["qr-records"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("qr_records")
      .select("*")
      .not("qr_code", "like", "CD-GOOGLE-%")
      .not("qr_code", "like", "CD-INSTAGRAM-%")
      .order("qr_code");
    if (error) throw error;
    return data as QrRecord[];
  },
});

export type QrStatus = "active" | "inactive" | "awaiting";

export function statusOf(record: QrRecord): QrStatus {
  if (!record.destination_url) return "awaiting";
  return record.is_active ? "active" : "inactive";
}
