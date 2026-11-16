import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cardDesigns, type CardDesign } from "@/lib/card-designs";

export const designRecordsQueryOptions = (design: CardDesign) => queryOptions({
  queryKey: ["card-designs", design],
  queryFn: async () => {
    const { data, error } = await supabase.from("qr_records").select("*").like("qr_code", `${cardDesigns[design].prefix}%`).order("qr_code");
    if (error) throw error;
    return data;
  },
});