/**
 * Drawers — /tools/drawers. The team workspace, fully cloud-backed. The section
 * palette (which chests exist) comes from the live section registry; the drawer
 * trees themselves are loaded from the shared workspace API by the client, so
 * every teammate sees the same content.
 */

import DrawersWorkshop from "@/components/tools/drawers/DrawersWorkshop";
import StorageNote from "./storage-note";
import type { DemoSection } from "@/components/tools/drawers/types";
import { getSections } from "@/lib/sections";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Drawers",
  description:
    "Catarina's drawers — organized project envelopes and files for every team section, synced to the shared team cloud.",
};

/* ─── Storage note (edit me) ───────────────────────────────────────────────
   The team workspace is backed by a Turso database on its free tier. If you
   run Catarina on a different cloud, update these four values — the note at
   the bottom of the page renders from them automatically. */
const STORAGE_PROVIDER = "Turso (free tier)";
const STORAGE_LIMITS = ["5 GB total storage", "500M rows read / 10M rows written per month", "300 MB per file, split into 3 MB parts and reassembled automatically"] as const;
const STORAGE_NOTE =
  "The team drawers on this page store files in the default cloud backend — " +
  "a hosted SQLite database (" + STORAGE_PROVIDER + "). Everything you upload " +
  "lives there, and the panel below always tells the truth about what fits. " +
  "Changes appear instantly and sync in the background, so the small lag you " +
  "sometimes feel is the cloud backend's round-trip time — it can differ from " +
  "one hosting service to another.";
const STORAGE_FULL_HINT =
  "Storage filling up? The quick, zero-migration fix: park big media in " +
  "whatever cloud you already use, then add a LINK item in the drawer that " +
  "points at it. A link takes almost no space and teammates open it straight " +
  "from focus mode — no big files, no cleanup.";

export default async function DrawersPage() {
  /* Live section palette — the chests themselves are the team's real sections
     (from the registry). Drawer trees load from the workspace API, so there is
     no demo data on this page anymore. */
  const registry = await getSections();
  const sections: DemoSection[] = registry.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    projects: [],
  }));

  return (
    <div className="space-y-20 overflow-x-clip">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
            The Drawers
          </h1>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold tracking-wide text-accent uppercase">
            Team workspace
          </span>
          <div
            id="drawers-cloud-status-landscape"
            className="drawers-cloud-status-slot drawers-cloud-status-slot--landscape"
          />
        </div>
        <p className="max-w-full text-sm text-text-muted">
          Every section of the studio keeps its work in a chest, and each
          project pulls out like its own drawer — envelopes tuck the fiddly
          sub-things inside, loose files ride on top. Drop a file, pin a link,
          scratch a note: it lands in the shared cloud at once, so every
          teammate opens the same drawer you just closed.
        </p>
        <p className="max-w-full text-sm text-text-muted">
          Deletes are permanent: a drawer, envelope or file you remove is gone
          for the whole team for good — its stored bytes are purged from the
          cloud, with no undo. Changes appear in the chest the moment you make
          them, then sync in the background; how quickly that sync lands is up
          to the cloud backend you&apos;re on, so it can differ from one hosting
          service to another.
        </p>
        <div
          id="drawers-cloud-status-portrait"
          className="drawers-cloud-status-slot drawers-cloud-status-slot--portrait"
        />
      </header>

      <DrawersWorkshop sections={sections} />

      <StorageNote
        provider={STORAGE_PROVIDER}
        limits={STORAGE_LIMITS}
        note={STORAGE_NOTE}
        fullHint={STORAGE_FULL_HINT}
      />
    </div>
  );
}
