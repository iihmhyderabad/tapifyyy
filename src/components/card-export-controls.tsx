import { useState } from "react";
import { Download, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepareCardExport, saveCardBlob } from "@/lib/card-export";
import { cardExportFormats, type CardExportFormat } from "@/lib/export-formats";

export function CardExportControls({ code, getCard }: { code: string; getCard: () => HTMLElement | null }) {
  const [busy, setBusy] = useState<CardExportFormat | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; filename: string } | null>(null);

  async function prepare(format: CardExportFormat) {
    const card = getCard();
    if (!card) { toast.error("Card unavailable. Please try again."); return; }
    setBusy(format); setReady(null);
    const staging = document.createElement("div");
    staging.className = "card-export-staging";
    const copy = card.cloneNode(true);
    if (!(copy instanceof HTMLElement)) { setBusy(null); return; }
    staging.append(copy); document.body.append(staging);
    try {
      const blob = await prepareCardExport(copy, format);
      setReady({ blob, filename: `${code}-4x4${format === "png" ? "-8K" : format === "psd" ? "-600dpi" : ""}.${format}` });
    } catch { toast.error("Could not prepare export. Please try again."); }
    finally { staging.remove(); setBusy(null); }
  }

  return <section className="no-print w-full" aria-label={`Download/Export Format ${code}`}>
    <h3 className="mb-2 text-center text-xs font-semibold text-muted-foreground">Download/Export Format</h3>
    <div className="flex flex-wrap justify-center gap-2">
      {cardExportFormats.map(({ format, label }) => <Button key={format} variant="outline" size="sm" className="btn-outline text-xs" disabled={busy !== null} onClick={() => prepare(format)}>{busy === format ? <LoaderCircle className="animate-spin" /> : <Download />}{busy === format ? "Preparing…" : label}</Button>)}
    </div>
    {ready && <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="status">
      <span className="w-full break-all text-center text-xs text-muted-foreground">{ready.filename}</span>
      <Button size="sm" className="btn-gold" onClick={() => saveCardBlob(ready.blob, ready.filename)}><Download />Download ready file</Button>
      <Button variant="ghost" size="icon" aria-label="Close ready export" onClick={() => setReady(null)}><X /></Button>
    </div>}
  </section>;
}