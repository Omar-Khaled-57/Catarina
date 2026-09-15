"use client";

/**
 * CreateTableModal — name + section picker for a new TeamTable. Only sections
 * the user is allowed to write in are offered; admin sees everything.
 */

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

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
  isOpen: boolean;
  onClose: () => void;
  sectionMeta: Record<string, { label: string; color: string }>;
  writableSections: string[];
  onCreate: (table: TableListItem) => void;
  onError: (message: string) => void;
}

export default function CreateTableModal({
  isOpen,
  onClose,
  sectionMeta,
  writableSections,
  onCreate,
  onError,
}: Props) {
  const [name, setName] = useState("");
  const [section, setSection] = useState<string | null>(
    writableSections[0] ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && section != null && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), section }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Create failed");
      setSubmitting(false);
      setName("");
      onCreate(data.table as TableListItem);
    } catch (e) {
      setSubmitting(false);
      onError(e instanceof Error ? e.message : "Create failed");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New table" maxWidth="max-w-md">
      <div className="space-y-5">
        <div>
          <label htmlFor="table-name" className="mb-1.5 block text-sm font-semibold text-text">
            Table name
          </label>
          <input
            id="table-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) void submit();
            }}
            placeholder="e.g. Sprint board"
            maxLength={120}
            autoFocus
            className="w-full rounded-xl border border-border bg-surface-2/50 px-4 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/60 focus:border-accent/50 focus:bg-surface-2"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-text">Section</span>
          {writableSections.length === 0 ? (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              You don&apos;t manage tables in any section yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {writableSections.map((key) => {
                const meta = sectionMeta[key] ?? { label: key, color: "#00E8A2" };
                const active = section === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSection(key)}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold text-text transition-colors ${
                      active
                        ? "border-accent/50 bg-accent/10"
                        : "border-border bg-surface-2/40 hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                      aria-hidden="true"
                    />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button
          onClick={() => void submit()}
          disabled={!canSubmit}
          isLoading={submitting}
          className="w-full"
        >
          Create table
        </Button>
      </div>
    </Modal>
  );
}