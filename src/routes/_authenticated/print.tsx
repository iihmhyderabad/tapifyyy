import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MasterNfcCard } from "@/components/master-nfc-card";
import { qrRecordsQueryOptions, type QrRecord } from "@/data/qr-queries";
import { downloadDataUrl, permanentUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { CardExportControls } from "@/components/card-export-controls";

export const Route = createFileRoute("/_authenticated/print")({
  head: () => ({
    meta: [
      { title: "Print NFC Cards — Dynamic QR Manager" },
      {
        name: "description",
        content:
          "Print-ready 4x4 inch Google Review NFC card previews, one per QR code, with genuine scannable QR codes.",
      },
      { property: "og:title", content: "Print NFC Cards — Dynamic QR Manager" },
      {
        property: "og:description",
        content:
          "Print-ready 4x4 inch Google Review NFC card previews, one per QR code, with genuine scannable QR codes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(qrRecordsQueryOptions),
  component: PrintPage,
});

function NfcCard({ record }: { record: QrRecord }) {
  return <MasterNfcCard code={record.qr_code} url={permanentUrl(record.qr_code)} />;
}

async function exportCardPng(el: HTMLElement, qrCode: string) {
  const dataUrl = await toPng(el, { pixelRatio: 3.125, backgroundColor: "#ffffff" });
  downloadDataUrl(dataUrl, `${qrCode}-nfc-card.png`);
}

function PrintPage() {
  const navigate = useNavigate();
  const { data: records } = useSuspenseQuery(qrRecordsQueryOptions);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate({ to: "/login" });
    } catch {
      navigate({ to: "/login" });
    }
  }

  async function downloadOne(record: QrRecord) {
    const el = cardRefs.current[record.qr_code];
    if (!el) return;
    try {
      await exportCardPng(el, record.qr_code);
      toast.success(`${record.qr_code} card exported (1200×1200 px)`);
    } catch {
      toast.error(`Could not export ${record.qr_code}. Please try again.`);
    }
  }

  async function downloadAll() {
    toast.info(`Exporting all ${records.length} cards…`);
    for (const record of records) {
      const el = cardRefs.current[record.qr_code];
      if (!el) continue;
      try {
        await exportCardPng(el, record.qr_code);
      } catch {
        toast.error(`Could not export ${record.qr_code}.`);
      }
    }
    toast.success("All cards exported");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="btn-ghost">
              ← Dashboard
            </Link>
            <span className="font-display text-lg font-bold text-foreground">
              Print NFC Cards
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="btn-outline" onClick={downloadAll}>
              Download all PNGs
            </Button>
            <Button type="button" className="btn-gold" onClick={() => window.print()}>
              Print all
            </Button>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost text-muted-foreground hover:text-destructive flex items-center gap-1.5"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="print:!m-0 print:!p-0 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="no-print mb-6 text-sm text-muted-foreground">
          {records.length} print previews below, one per card. Each card is exactly 4×4 inches;
          the QR code inside is genuine and permanent. Export a card as a
          high-resolution PNG (1200×1200 px ≈ 300 DPI) or print them, one per page.
        </p>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => (
            <div key={record.id} className="print-card-slot flex flex-col items-center gap-3">
              <div
                ref={(el) => {
                  cardRefs.current[record.qr_code] = el;
                }}
              >
                <NfcCard record={record} />
              </div>
              <p className="no-print text-xs font-semibold text-muted-foreground">
                {record.qr_code} · Front Side (4×4 inch)
              </p>
              <Button
                type="button"
                variant="outline"
                className="no-print btn-outline text-xs"
                onClick={() => downloadOne(record)}
              >
                Export {record.qr_code} PNG
              </Button>
               <CardExportControls code={record.qr_code} getCard={() => {
                 const card = cardRefs.current[record.qr_code]?.firstElementChild;
                 return card instanceof HTMLElement ? card : null;
               }} />
            </div>
          ))}
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
    </div>
  );
}
