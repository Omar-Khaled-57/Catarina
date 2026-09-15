"use client";

/**
 * ExportPDFModal — themed PDF export via the app's hidden-iframe print
 * pattern (same as the archived-month report). Dark/light picker + an
 * "include stickers" toggle (default off).
 */

import { useState } from "react";
import { toast } from "sonner";
import { Moon, Sun, CheckCircle2, ChevronRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  buildTablePdfHtml,
  resolvePdfOrientation,
  type PdfOrientation,
} from "@/lib/table/pdf";
import type { PdfTheme } from "@/lib/pdf-palette";
import type { TableDocument } from "@/hooks/useTableGrid";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doc: TableDocument;
}

const ORIENTATIONS: { value: PdfOrientation; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Wide tables flip" },
  { value: "portrait", label: "Portrait", hint: "297mm tall" },
  { value: "landscape", label: "Landscape", hint: "297mm wide" },
];

export default function ExportPDFModal({ isOpen, onClose, doc }: Props) {
  const [theme, setTheme] = useState<PdfTheme>("dark");
  const [includeStickers, setIncludeStickers] = useState(false);
  const [orientation, setOrientation] = useState<PdfOrientation>("auto");

  const handleExport = () => {
    const html = buildTablePdfHtml({
      table: {
        id: doc.id,
        name: doc.name,
        section: doc.section,
        color: doc.color,
        cells: doc.grid,
        stickers: doc.stickers,
        isDateBased: doc.isDateBased,
      },
      theme,
      includeStickers,
      orientation,
    });

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
    onClose();
    toast.success("Opening the print dialog…");
  };

  const resolvedOrientation = resolvePdfOrientation(doc.grid, orientation);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export PDF" maxWidth="max-w-md">
      <p className="mb-5 text-sm text-text-muted">
        Print the table as a themed A4 document — same look the app has right
        now, with merged cells preserved.
      </p>

      {/* Color Theme — card picker, same treatment as the monthly report.
          Single column on very small screens so height scales with width. */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Color Theme
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-pressed={theme === "dark"}
            className={`relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all sm:p-4 ${
              theme === "dark"
                ? "border-accent bg-accent/5"
                : "border-border/40 hover:border-border"
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0D1824] border border-[rgba(0,232,162,0.15)] sm:h-9 sm:w-9">
              <Moon size={16} className="text-[#00E8A2]" />
            </div>
            <div>
              <p className="text-sm font-bold text-text">Dark</p>
              <p className="text-[10px] text-text-muted">Neon teal on dark</p>
            </div>
            {theme === "dark" && (
              <CheckCircle2 size={14} className="absolute top-2 right-2 text-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-pressed={theme === "light"}
            className={`relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all sm:p-4 ${
              theme === "light"
                ? "border-accent bg-accent/5"
                : "border-border/40 hover:border-border"
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F6FF] border border-[rgba(0,196,122,0.3)] sm:h-9 sm:w-9">
              <Sun size={16} className="text-[#00C47A]" />
            </div>
            <div>
              <p className="text-sm font-bold text-text">Light</p>
              <p className="text-[10px] text-text-muted">Clean white background</p>
            </div>
            {theme === "light" && (
              <CheckCircle2 size={14} className="absolute top-2 right-2 text-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Page orientation — stacks vertically on narrow screens so the
          buttons aren't squished into three cramped columns. */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Orientation
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setOrientation(o.value)}
              aria-pressed={orientation === o.value}
              className={`relative w-full rounded-xl border-2 p-3 text-left transition-all ${
                orientation === o.value
                  ? "border-accent bg-accent/5"
                  : "border-border/40 hover:border-border"
              }`}
            >
              <p className="text-sm font-bold text-text">{o.label}</p>
              <p className="text-[10px] text-text-muted">{o.hint}</p>
              {orientation === o.value && (
                <CheckCircle2
                  size={14}
                  className="absolute right-2 top-2 text-accent"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Document summary */}
      <div className="mb-5 rounded-xl bg-surface-2/50 border border-border/30 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Document includes
        </p>
        <div className="space-y-1.5">
          {[
            `"${doc.name}" — ${doc.section} · ${doc.grid.rows.length} rows × ${doc.grid.cols} cols`,
            `Merged cells preserved (${doc.grid.rows
              .flat()
              .filter((c) => c && (c.rs > 1 || c.cs > 1)).length})`,
            includeStickers
              ? `${doc.stickers.length} sticker${doc.stickers.length === 1 ? "" : "s"} included`
              : "Stickers excluded",
            orientation === "auto"
              ? `A4 print — ${resolvedOrientation} (auto)`
              : `A4 print — ${orientation}`,
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-text">
              <ChevronRight size={12} className="text-accent shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={includeStickers}
        onClick={() => setIncludeStickers((v) => !v)}
        className="group mb-6 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3 text-left transition-colors hover:border-accent/30 hover:bg-surface-2"
      >
        <span>
          <span className="block text-sm font-semibold text-text">Include stickers</span>
          <span className="block text-xs text-text-muted">
            Print a copy of the Rina decorations too
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
            includeStickers ? "bg-accent" : "bg-border/70"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform duration-200 ${
              includeStickers ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </button>

      <Button onClick={handleExport} className="w-full">
        Export PDF
      </Button>
    </Modal>
  );
}