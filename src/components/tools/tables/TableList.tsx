"use client";

/**
 * TableList — the /tools/tables landing: groups the team's tables by section
 * and creates new ones (section picker gated by write permission). Data comes
 * from GET /api/tables so admins and members always see exactly what they can
 * reach, with no stale server copy.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Table2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import CreateTableModal from "./CreateTableModal";

interface TableListItem {
  id: string;
  section: string;
  name: string;
  color: string;
  isDateBased: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  sectionMeta: Record<string, { label: string; color: string }>;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function TableList({ sectionMeta }: Props) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [tables, setTables] = useState<TableListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  /* Fetch on mount (sets loading/error, then fetch-driven states settle in the
     promise chain — mirrors NotificationModal's load effect). */
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync loading state for the fetch
    setLoading(true);
    setError(null);
    fetch("/api/tables")
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return (await res.json()) as { tables: TableListItem[] };
      })
      .then((data) => {
        if (!cancelled) setTables(data.tables);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the team tables");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setLoading(true);
    setError(null);
    fetch("/api/tables")
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return (await res.json()) as { tables: TableListItem[] };
      })
      .then((data) => setTables(data.tables))
      .catch(() => setError("Couldn't load the team tables"))
      .finally(() => setLoading(false));
  };

  const writableSections = (user?.sections ?? []).filter(() =>
    isAdmin ? true : user?.permissions?.canManageTables,
  );

  const groupOrder = Array.from(
    new Set(tables.map((t) => t.section).concat(writableSections)),
  ).sort();

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-text">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="text-sm font-semibold text-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-text">Team tables</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-[0_0_20px_var(--color-accent-glow)] transition-all hover:brightness-110 active:scale-95"
        >
          <Plus size={16} /> New table
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[24vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          <span className="sr-only">Loading tables…</span>
        </div>
      ) : tables.length === 0 ? (
        <div className="flex min-h-[24vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2/30 text-center">
          <Table2 size={36} className="text-text-muted" />
          <p className="font-semibold text-text">No tables yet</p>
          <p className="max-w-sm text-sm text-text-muted">
            Create one and the whole team will see it here, organized by section.
          </p>
        </div>
      ) : (
        groupOrder.map((sectionKey) => {
          const list = tables.filter((t) => t.section === sectionKey);
          if (list.length === 0) return null;
          const meta = sectionMeta[sectionKey] ?? { label: sectionKey, color: "#00E8A2" };
          return (
            <section key={sectionKey}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-muted">
                  {meta.label}
                </h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-text-muted">
                  {list.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((table) => (
                  <Link
                    key={table.id}
                    href={`/tools/tables/${table.id}`}
                    className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface-2/40 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ background: `color-mix(in srgb, ${table.color} 18%, transparent)` }}
                          aria-hidden="true"
                        >
                          <Table2 size={17} style={{ color: table.color }} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-text">{table.name}</p>
                          <p className="text-[11px] font-semibold text-text-muted">
                            {table.isDateBased ? "Date mode • " : ""}
                            {timeAgo(table.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <ArrowRight
                        size={16}
                        className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}

      <CreateTableModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        sectionMeta={sectionMeta}
        writableSections={writableSections}
        onCreate={(table) => {
          setTables((prev) =>
            [table, ...prev].sort((a, b) => a.section.localeCompare(b.section)),
          );
          toast.success(`Created "${table.name}"`);
          router.push(`/tools/tables/${table.id}`);
        }}
        onError={(msg) => toast.error(msg)}
      />
    </div>
  );
}