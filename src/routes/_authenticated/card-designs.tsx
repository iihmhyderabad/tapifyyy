import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Download, Edit, LogOut, Printer, Plus, Power, SlidersHorizontal, X } from "lucide-react";
import { toPng } from "html-to-image";
import { zipSync } from "fflate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DesignCard } from "@/components/design-card";
import { CardExportControls } from "@/components/card-export-controls";
import { BulkCardDownloadModal } from "@/components/bulk-card-download-modal";
import { designRecordsQueryOptions } from "@/data/card-design-queries";
import { type QrRecord, statusOf } from "@/data/qr-queries";
import { cardDesigns, designCodes, DESIGN_CARD_COUNT, type CardDesign } from "@/lib/card-designs";
import { downloadDataUrl, permanentUrl, sanitizeDestination, validateDestinationUrl } from "@/lib/qr";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/card-designs")({
  head: () => ({ meta: [
    { title: "Card Designs — Dynamic QR Manager" },
    { name: "description", content: "Separate RanchiTap Google Review and Instagram NFC cards with editable dynamic QR links and 4×4 inch printing." },
    { property: "og:title", content: "Card Designs — Dynamic QR Manager" },
    { property: "og:description", content: "Manage and print separate Google Review and Instagram NFC card collections." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(designRecordsQueryOptions("google")), context.queryClient.ensureQueryData(designRecordsQueryOptions("instagram"))]); },
  component: CardDesignsPage,
});

function CardDesignsPage() {
  const navigate = useNavigate();
  const [design, setDesign] = useState<CardDesign>("google");
  const [busy, setBusy] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editing, setEditing] = useState<QrRecord | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: records } = useSuspenseQuery(designRecordsQueryOptions(design));
  const queryClient = useQueryClient();
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["card-designs"] });

  async function generate() {
    setBusy(true);
    try {
      const { error } = await supabase.from("qr_records").upsert(designCodes(design).map((qr_code) => ({ qr_code, client_name: cardDesigns[design].name, is_active: true })), { onConflict: "qr_code", ignoreDuplicates: true });
      if (error) throw error;
      await refresh(); toast.success(`${DESIGN_CARD_COUNT} unique cards ready`);
    } catch { toast.error("Could not generate cards. Please try again."); } finally { setBusy(false); }
  }

  async function png(record: QrRecord) {
    const el = refs.current[record.qr_code];
    if (!el) throw new Error("Card unavailable");
    await document.fonts.ready;
    return toPng(el, { width: el.offsetWidth, height: el.offsetHeight, pixelRatio: 3.125 });
  }

  async function download(record?: QrRecord) {
    setBusy(true);
    try {
      if (record) downloadDataUrl(await png(record), `${record.qr_code}-4x4.png`);
      else {
        const files: Record<string, Uint8Array> = {};
        for (const row of records) {
          const data = await png(row);
          files[`${row.qr_code}-4x4.png`] = Uint8Array.from(atob(data.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
        }
        const blob = new Blob([zipSync(files) as BlobPart], { type: "application/zip" });
        const link = URL.createObjectURL(blob);
        downloadDataUrl(link, `${design}-nfc-cards.zip`);
        setTimeout(() => URL.revokeObjectURL(link), 1000);
      }
      toast.success("Cards downloaded");
    } catch { toast.error("Could not download cards. Please try again."); } finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    const invalid = validateDestinationUrl(url);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    const { error } = await supabase.from("qr_records").update({ destination_url: sanitizeDestination(url), client_name: name.trim() || cardDesigns[design].name }).eq("id", editing.id);
    setBusy(false);
    if (error) { setError("Could not save the card."); return; }
    setEditing(null); await refresh(); toast.success("Card updated");
  }

  async function toggle(record: QrRecord) {
    const { error } = await supabase.from("qr_records").update({ is_active: !record.is_active }).eq("id", record.id);
    if (error) toast.error("Could not update card status."); else await refresh();
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate({ to: "/login" });
    } catch {
      navigate({ to: "/login" });
    }
  }

  return <div className="min-h-screen bg-background card-designs-page">
    <header className="no-print border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="font-display text-lg font-bold">Dynamic QR Manager</span>
        <nav className="flex flex-wrap items-center gap-1">
          <Link to="/dashboard" className="btn-ghost">Dashboard</Link>
          <Link to="/print" className="btn-ghost">Print cards</Link>
          <Link to="/card-designs" className="btn-ghost text-foreground">Card Designs</Link>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost text-muted-foreground hover:text-destructive flex items-center gap-1.5"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="no-print font-display text-3xl font-bold">Card Designs</h1>
      <div className="no-print mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Card design">
        {(Object.keys(cardDesigns) as CardDesign[]).map((key) => <Button key={key} role="tab" aria-selected={key === design} className={key === design ? "btn-gold" : "btn-outline"} onClick={() => setDesign(key)}>{cardDesigns[key].name}</Button>)}
      </div>
      <div className="no-print my-6 flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-display text-xl font-bold">{cardDesigns[design].name}</h2><p className="mt-1 text-sm text-muted-foreground">{records.length} cards · Front Side · NFC Print Ready</p></div>
        <div className="flex flex-wrap gap-2">
          {records.length < DESIGN_CARD_COUNT && <Button className="btn-gold" disabled={busy} onClick={generate}><Plus />Generate {DESIGN_CARD_COUNT} cards</Button>}
          <Button className="btn-outline flex items-center gap-1.5" disabled={!records.length} onClick={() => setBulkModalOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />Bulk / Range Download
          </Button>
          <Button className="btn-gold" disabled={!records.length} onClick={() => window.print()}><Printer />Print {design === "google" ? "Google" : "Instagram"} cards</Button>
        </div>
      </div>
      <div className="designs-grid grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {records.map((record) => <div key={record.id} className="design-print-slot min-w-0">
          <div className="design-preview"><div ref={(el) => { refs.current[record.qr_code] = el; }}><DesignCard design={design} code={record.qr_code} url={permanentUrl(record.qr_code)} /></div></div>
          <div className="no-print mt-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold">{record.qr_code}</span><span className="text-xs text-muted-foreground">{statusOf(record) === "awaiting" ? "Awaiting link" : record.is_active ? "Active" : "Inactive"}</span></div>
            <p className="mt-1 truncate text-sm text-muted-foreground" title={record.destination_url ?? undefined}>{record.destination_url || record.client_name}</p>
            <div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => { setEditing(record); setUrl(record.destination_url ?? ""); setName(record.client_name); setError(null); }}><Edit />Edit</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => download(record)}><Download />PNG</Button><Button variant="outline" size="icon" title={record.is_active ? "Disable card" : "Enable card"} aria-label={`${record.is_active ? "Disable" : "Enable"} ${record.qr_code}`} onClick={() => toggle(record)}><Power /></Button></div>
             <div className="mt-4"><CardExportControls code={record.qr_code} getCard={() => {
               const card = refs.current[record.qr_code]?.firstElementChild;
               return card instanceof HTMLElement ? card : null;
             }} /></div>
          </div>
        </div>)}
      </div>
    </main>
    <footer className="no-print mt-16 border-t border-border/80 bg-card/50 py-6 text-center text-xs text-muted-foreground">
      <p>
        Dynamic QR Manager · Made by{" "}
        <a
          href="https://naveen-kr.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gold hover:underline transition-colors"
        >
          Naveen Kumar
        </a>
      </p>
    </footer>
    {editing && <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="edit-card-title" className="w-full max-w-md rounded-lg border border-border bg-card p-6"><div className="mb-4 flex items-center justify-between"><h2 id="edit-card-title" className="font-display text-lg font-bold">Edit {editing.qr_code}</h2><Button variant="ghost" size="icon" aria-label="Close" onClick={() => setEditing(null)}><X /></Button></div><form onSubmit={save}><label className="field-label" htmlFor="design-name">Client / business</label><input id="design-name" className="field-input mb-4" value={name} onChange={(e) => setName(e.target.value)} /><label className="field-label" htmlFor="design-url">Destination URL</label><input id="design-url" className="field-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}<Button type="submit" className="btn-gold mt-5" disabled={busy}>Save changes</Button></form></section></div>}
    <BulkCardDownloadModal
      open={bulkModalOpen}
      onClose={() => setBulkModalOpen(false)}
      title={cardDesigns[design].name}
      records={records}
      cardType={design === "instagram" ? "instagram-design" : "google-design"}
      getCardElement={(rec) => refs.current[rec.qr_code]}
    />
  </div>;
}