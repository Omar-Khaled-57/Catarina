"use client";

/**
 * StorageNote — the page-footer panels that explain where drawer files live.
 * Desktop shows the two cards side by side in a row; mobile stacks them. Each
 * card's details reveal/collapse with a clip-path wipe (top-anchored) matched
 * to a height collapse, so the motion is one smooth gesture. Honors the user's
 * reduce-motion preference, and while collapsed the content is inert (not
 * focusable) and aria-hidden.
 *
 * All copy is injected by the server page — see the STORAGE_* constants at the
 * top of src/app/tools/drawers/page.tsx.
 */

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Database, Link2 } from "lucide-react";

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

function ClipReveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: reduce ? undefined : `grid-template-rows 0.42s ${ease}`,
      }}
    >
      <div
        aria-hidden={!open}
        inert={open ? undefined : true}
        className="min-h-0 overflow-hidden"
        style={{
          clipPath: open ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
          transition: reduce ? undefined : `clip-path 0.42s ${ease}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StorageCard({
  icon: Icon,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  icon: typeof Database;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/70 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-accent/10 text-accent">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-text-muted">
            {summary}
          </span>
        </span>
        <ChevronDown
          className="mt-1 size-4 shrink-0 text-text-muted"
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.3s ease",
          }}
        />
      </button>

      <div className="pt-4">
        <ClipReveal open={open}>{children}</ClipReveal>
      </div>
    </div>
  );
}

export default function StorageNote({
  provider,
  limits,
  note,
  fullHint,
}: {
  provider: string;
  limits: readonly string[];
  note: string;
  fullHint: string;
}) {
  return (
    <section
      aria-label="Storage"
      className="mx-auto w-full max-w-4xl landscape:max-w-none landscape:w-[80vw]"
    >
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <StorageCard
          icon={Database}
          title="Where everything lives"
          summary="The team drawers sync into a hosted SQLite database."
        >
          <p className="text-sm leading-relaxed text-text-muted">{note}</p>
          <ul className="mt-3 space-y-2">
            {limits.map((limit) => (
              <li
                key={limit}
                className="flex items-start gap-2 text-xs leading-relaxed text-text-muted"
              >
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <span>
                  <span className="font-semibold text-text">{provider}</span> —{" "}
                  {limit}
                </span>
              </li>
            ))}
          </ul>
        </StorageCard>

        <StorageCard
          icon={Link2}
          title="Full? Quick fix"
          summary="Big media belongs on your cloud — a drawer link keeps it one tap away."
        >
          <p className="text-sm leading-relaxed text-text-muted">{fullHint}</p>
        </StorageCard>
      </div>

      <p className="mt-5 px-1 text-xs text-text-muted/70">
        Running Catarina on your own cloud backend? Change{" "}
        <code className="rounded bg-accent/10 px-1 py-0.5 font-mono text-[11px] text-accent">
          STORAGE_PROVIDER
        </code>
        ,{" "}
        <code className="rounded bg-accent/10 px-1 py-0.5 font-mono text-[11px] text-accent">
          STORAGE_LIMITS
        </code>{" "}
        and{" "}
        <code className="rounded bg-accent/10 px-1 py-0.5 font-mono text-[11px] text-accent">
          STORAGE_NOTE
        </code>{" "}
        at the top of this page — the panels above update automatically.
      </p>
    </section>
  );
}