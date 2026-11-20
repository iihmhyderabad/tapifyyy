import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Activity, LogOut, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BulkCardDownloadModal } from "@/components/bulk-card-download-modal";
import {
  qrRecordsQueryOptions,
  statusOf,
  type QrRecord,
  type QrStatus,
} from "@/data/qr-queries";
import {
  copyToClipboard,
  downloadDataUrl,
  downloadText,
  permanentUrl,
  qrPngDataUrl,
  qrSvgMarkup,
  sanitizeDestination,
  validateDestinationUrl,
} from "@/lib/qr";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dynamic QR Manager" },
      {
        name: "description",
        content:
          "Manage your Google Review NFC QR cards: destinations, status, scan counts and downloads.",
      },
      { property: "og:title", content: "Dashboard — Dynamic QR Manager" },
      {
        property: "og:description",
        content:
          "Manage your Google Review NFC QR cards: destinations, status, scan counts and downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(qrRecordsQueryOptions),
  component: DashboardPage,
});

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: QrStatus }) {
  const styles: Record<QrStatus, string> = {
    active: "border-gold/50 bg-gold/15 text-gold-deep",
    inactive: "border-border bg-muted text-muted-foreground",
    awaiting: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  const labels: Record<QrStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    awaiting: "Awaiting link",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function StatCard({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="stat-card">
      <p className="font-display text-4xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: records } = useSuspenseQuery(qrRecordsQueryOptions);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | QrStatus>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QrRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<QrRecord | null>(null);
  const [disabling, setDisabling] = useState<QrRecord | null>(null);
  const [pinging, setPinging] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  async function handlePingKeepAlive() {
    setPinging(true);
    try {
      const res = await fetch("/api/keep-alive");
      const data = await res.json();
      if (res.ok) {
        toast.success("Keep-alive ping successful! Supabase inactivity timer reset.");
      } else {
        toast.warning(data.message || "Keep-alive completed with warnings.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ping keep-alive endpoint");
    } finally {
      setPinging(false);
    }
  }

  const stats = useMemo(() => {
    const active = records.filter((r) => statusOf(r) === "active").length;
    const inactive = records.filter((r) => statusOf(r) === "inactive").length;
    const awaiting = records.filter((r) => statusOf(r) === "awaiting").length;
    return { total: records.length, active, inactive, awaiting };
  }, [records]);

  const qrRange = useMemo(() => {
    if (records.length === 0) return null;
    const codes = records.map((r) => r.qr_code);
    return { first: codes.reduce((a, b) => (a < b ? a : b)), last: codes.reduce((a, b) => (a > b ? a : b)) };
  }, [records]);

  const addPreview = useMemo(() => {
    const qty = Math.max(1, Math.floor(addQty) || 1);
    let max = 0;
    for (const r of records) {
      const m = /^GREV-(\d+)$/i.exec(r.qr_code.trim());
      if (m?.[1]) max = Math.max(max, parseInt(m[1], 10));
    }
    const first = `GREV-${String(max + 1).padStart(3, "0")}`;
    const last = qty === 1 ? first : `GREV-${String(max + qty).padStart(3, "0")}`;
    return { qty, first, last };
  }, [records, addQty]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const status = statusOf(r);
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      return (
        r.qr_code.toLowerCase().includes(q) ||
        r.client_name.toLowerCase().includes(q) ||
        (r.destination_url ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, search, filter]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["qr-records"] });
  }

  function openEdit(record: QrRecord) {
    setEditing(record);
    setEditName(record.client_name);
    setEditUrl(record.destination_url ?? "");
    setEditError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const nameError = editName.trim() ? null : "Client / business name is required.";
    const urlError = validateDestinationUrl(editUrl);
    const err = nameError ?? urlError;
    if (err) {
      setEditError(err);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("qr_records")
        .update({
          client_name: editName.trim(),
          destination_url: sanitizeDestination(editUrl),
        })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success(`${editing.qr_code} updated`);
      setEditing(null);
      refresh();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Could not save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    if (!disabling) return;
    const record = disabling;
    setDisabling(null);
    const { error } = await supabase
      .from("qr_records")
      .update({ is_active: false })
      .eq("id", record.id);
    if (error) {
      toast.error("Could not disable the QR code. Please try again.");
      return;
    }
    toast.success(`${record.qr_code} is now inactive`);
    refresh();
  }

  async function handleEnable(record: QrRecord) {
    const { error } = await supabase
      .from("qr_records")
      .update({ is_active: true })
      .eq("id", record.id);
    if (error) {
      toast.error("Could not enable the QR code. Please try again.");
      return;
    }
    toast.success(`${record.qr_code} is now active`);
    refresh();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const qty = Math.floor(addQty);
    if (!Number.isFinite(qty) || qty < 1 || qty > 2000) {
      setAddError("Enter a quantity between 1 and 2000.");
      return;
    }
    const urlError = validateDestinationUrl(addUrl);
    if (urlError) {
      setAddError(urlError);
      return;
    }
    setCreating(true);
    try {
      // Fresh read of existing IDs so new codes never collide, even if
      // another device added codes since this page loaded.
      const { data: existing, error: fetchError } = await supabase
        .from("qr_records")
        .select("qr_code");
      if (fetchError) throw fetchError;
      let max = 0;
      for (const row of existing ?? []) {
        const m = /^GREV-(\d+)$/i.exec(row.qr_code.trim());
        if (m?.[1]) max = Math.max(max, parseInt(m[1], 10));
      }
      const payload = Array.from({ length: qty }, (_, i) => ({
        qr_code: `GREV-${String(max + 1 + i).padStart(3, "0")}`,
        client_name: addName.trim() || "Unassigned",
        destination_url: sanitizeDestination(addUrl),
        is_active: true,
      }));
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase
          .from("qr_records")
          .insert(payload.slice(i, i + 500));
        if (error) throw error;
      }
      const firstCode = payload[0]?.qr_code ?? "";
      const lastCode = payload[payload.length - 1]?.qr_code ?? firstCode;
      toast.success(
        qty === 1
          ? `${firstCode} added`
          : `${qty} QR codes added (${firstCode} → ${lastCode})`,
      );
      setAddOpen(false);
      setAddQty(1);
      setAddName("");
      setAddUrl("");
      setAddError(null);
      refresh();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Could not add QR codes. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(record: QrRecord) {
    const ok = await copyToClipboard(permanentUrl(record.qr_code));
    if (ok) toast.success("Permanent QR URL copied");
    else toast.error("Could not copy — copy it manually from the field.");
  }

  async function handleDownloadPng(record: QrRecord) {
    const dataUrl = await qrPngDataUrl(permanentUrl(record.qr_code), 1024);
    downloadDataUrl(dataUrl, `${record.qr_code}-qr.png`);
    toast.success(`PNG saved — ${record.qr_code}-qr.png`);
  }

  async function handleDownloadSvg(record: QrRecord) {
    const svg = await qrSvgMarkup(permanentUrl(record.qr_code));
    downloadText(svg, "image/svg+xml", `${record.qr_code}-qr.svg`);
    toast.success(`SVG saved — ${record.qr_code}-qr.svg`);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-2 gap-0.5 rounded-md bg-gold/15 p-1">
              <span className="h-2 w-2 rounded-[2px] bg-gold" />
              <span className="h-2 w-2 rounded-[2px] border border-gold" />
              <span className="h-2 w-2 rounded-[2px] border border-gold" />
              <span className="h-2 w-2 rounded-[2px] bg-gold" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">
              Dynamic QR Manager
            </span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/dashboard" className="btn-ghost">
              Dashboard
            </Link>
            <Link to="/print" className="btn-ghost">
              Print cards
            </Link>
            <Link to="/card-designs" className="btn-ghost">
              Card Designs
            </Link>
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Google Review Cards
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Printed QR codes stay the same — you can change where they lead at any time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline flex items-center gap-1.5 text-xs py-2 px-3"
              onClick={handlePingKeepAlive}
              disabled={pinging}
              title="Prevent Supabase from pausing (triggers /api/keep-alive)"
            >
              <Activity className={`h-3.5 w-3.5 text-emerald-500 ${pinging ? "animate-spin" : ""}`} />
              <span>{pinging ? "Pinging Supabase…" : "Keep-Alive Ping"}</span>
            </button>
            <button
              type="button"
              className="btn-outline flex items-center gap-1.5 text-xs py-2 px-3"
              onClick={() => setBulkModalOpen(true)}
              title="Download cards or QR codes in bulk or custom ranges"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-gold" />
              <span>Bulk / Range Download</span>
            </button>
            <button
              type="button"
              className="btn-gold"
              onClick={() => {
                setAddError(null);
                setAddOpen(true);
              }}
            >
              + Add QR codes
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            value={stats.total}
            label="Total QR codes"
            hint={qrRange ? `${qrRange.first} → ${qrRange.last}` : "No QR codes yet"}
          />
          <StatCard value={stats.active} label="Active" hint="Live and redirecting" />
          <StatCard value={stats.inactive} label="Inactive" hint="Temporarily disabled" />
          <StatCard value={stats.awaiting} label="Awaiting links" hint="No destination yet" />
        </div>

        {/* Toolbar */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-80">
            <input
              type="search"
              className="field-input pl-9"
              placeholder="Search QR ID, client or URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ⌕
            </span>
          </div>
          <div>
            <label className="sr-only" htmlFor="status-filter">
              Filter by status
            </label>
            <select
              id="status-filter"
              className="field-input sm:w-52"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="awaiting">Awaiting link</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-semibold text-foreground">QR ID</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Client / business</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Destination URL</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => {
                  const status = statusOf(record);
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold tracking-wide text-foreground">
                        {record.qr_code}
                      </td>
                      <td className="px-4 py-3 text-foreground">{record.client_name}</td>
                      <td className="max-w-[240px] px-4 py-3">
                        {record.destination_url ? (
                          <a
                            href={record.destination_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-gold-deep hover:underline"
                            title={record.destination_url}
                          >
                            {record.destination_url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground italic">Awaiting destination</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            className="btn-outline px-2.5 py-1.5 text-xs"
                            onClick={() => openEdit(record)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-outline px-2.5 py-1.5 text-xs"
                            onClick={() => setPreviewing(record)}
                          >
                            QR
                          </button>
                          {record.is_active ? (
                            <button
                              type="button"
                              className="rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                              onClick={() => setDisabling(record)}
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-gold px-2.5 py-1.5 text-xs"
                              onClick={() => handleEnable(record)}
                            >
                              Enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No QR codes match your search or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit dialog */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.qr_code}` : "Edit"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="edit-name">
              Client / business name
            </label>
            <input
              id="edit-name"
              className="field-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Bella Italia Restaurant"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-url">
              Google Review URL (destination)
            </label>
            <input
              id="edit-url"
              type="url"
              className="field-input"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://g.page/r/…"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Must be an http:// or https:// link. Leave empty to keep this QR
              awaiting a destination.
            </p>
          </div>
          {editError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {editError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-gold" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / bulk-generate dialog */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add QR codes"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="add-qty">
              How many QR codes?
            </label>
            <input
              id="add-qty"
              type="number"
              min={1}
              max={2000}
              step={1}
              className="field-input"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value === "" ? ("" as unknown as number) : Number(e.target.value))}
              placeholder="e.g. 1, 100 or 200"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {addPreview.qty === 1
                ? `New code will be ${addPreview.first}.`
                : `New codes will run ${addPreview.first} → ${addPreview.last}. IDs are always unique — the printed codes never change.`}
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="add-name">
              Client / business name (optional)
            </label>
            <input
              id="add-name"
              className="field-input"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Leave empty for Unassigned"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="add-url">
              Google Review URL (optional)
            </label>
            <input
              id="add-url"
              type="url"
              className="field-input"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://g.page/r/…"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              You can set or change this later at any time. Each code gets its
              own permanent redirect link, just like your existing cards.
            </p>
          </div>
          {addError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {addError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-gold" disabled={creating}>
              {creating ? "Adding…" : addPreview.qty === 1 ? "Add QR code" : `Add ${addPreview.qty} QR codes`}
            </button>
          </div>
        </form>
      </Modal>

      {/* QR preview dialog */}
      <Modal
        open={previewing !== null}
        onClose={() => setPreviewing(null)}
        title={previewing ? `${previewing.qr_code} — QR preview` : "QR preview"}
      >
        {previewing && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl border border-border bg-white p-4">
              <QRCodeSVG
                value={permanentUrl(previewing.qr_code)}
                size={208}
                marginSize={3}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="permanent-url">
                Permanent QR URL (printed on the card)
              </label>
              <div className="flex gap-2">
                <input
                  id="permanent-url"
                  readOnly
                  className="field-input font-mono text-xs"
                  value={permanentUrl(previewing.qr_code)}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="btn-outline shrink-0"
                  onClick={() => handleCopy(previewing)}
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-gold"
                onClick={() => handleDownloadPng(previewing)}
              >
                Download PNG
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => handleDownloadSvg(previewing)}
              >
                Download SVG
              </button>
            </div>
            <div className="rounded-xl bg-secondary p-3 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Scans</span>
                <span className="font-semibold text-foreground">{previewing.scan_count}</span>
              </p>
              <p className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Last scanned</span>
                <span className="font-semibold text-foreground">
                  {previewing.last_scanned_at
                    ? new Date(previewing.last_scanned_at).toLocaleString()
                    : "Never"}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Scanning always goes to the current destination — the QR image never
              needs to be reprinted.
            </p>
          </div>
        )}
      </Modal>

      {/* Disable confirmation */}
      <Modal
        open={disabling !== null}
        onClose={() => setDisabling(null)}
        title={disabling ? `Disable ${disabling.qr_code}?` : "Disable"}
      >
        {disabling && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              While inactive, anyone scanning this card sees a friendly "inactive"
              message instead of the business page. The printed QR code stays
              valid and can be re-enabled at any time.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setDisabling(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
                onClick={handleDisable}
              >
                Disable QR
              </button>
            </div>
          </div>
        )}
      </Modal>

      <footer className="mt-16 border-t border-border/80 bg-card/50 py-6 text-center text-xs text-muted-foreground">
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

      <BulkCardDownloadModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Google Review Cards"
        records={records}
        cardType="master-nfc"
      />
    </div>
  );
}
