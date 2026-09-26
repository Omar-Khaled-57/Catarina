/**
 * Themed PDF export for TeamTable.
 *
 * Builds a self-contained A4 HTML document (inline styles only) that the
 * client renders into a hidden off-screen iframe and calls print() on — the
 * same stylized pipeline as the archived-month report (branded gradient
 * header band, uppercase section caption, themed footer, Inter type, exact
 * print colors). Merged cells become real rowspan/colspan cells; the grid's
 * accent drives the header gradient + today strip; stickers are optionally
 * rendered as absolutely-positioned transparent sprites over the table
 * canvas. Wide grids flip to landscape A4.
 */

import { PDF_PALETTE, type PdfTheme } from "@/lib/pdf-palette";
import type { GridState } from "@/lib/table/grid";
import { detectDateAxis, todayIndex } from "@/lib/table/date";

/* Paper model (px, A4 @96dpi): usable width = page width minus the two 12px
   page-side margins; usable height = page height minus the header band,
   section caption and footer (chrome). */
const PX_PER_MM = 96 / 25.4;
const PAGE_W = 210 * PX_PER_MM; // portrait width == landscape height
const PAGE_H = 297 * PX_PER_MM; // portrait height == landscape width
const PAGE_SIDE = 24; // 2 × 12px page margins
const PAGE_CHROME = 170; // header band + caption + footer
const COLUMN_W = 120; // default column width when not resized
const ROW_H = 34; // default row height when not resized

/**
 * Decide the page orientation for a table. Explicit choices are honored;
 * Auto estimates the table's natural size (honouring stored column/row widths
 * and heights) and picks the page that fits it best — preferring portrait
 * unless the table genuinely reads better landscape. Horizontal overflow is
 * penalised extra because a cut-off table is worse than extra page height.
 */
export function resolvePdfOrientation(
  grid: GridState,
  orientation: PdfOrientation = "auto",
): "portrait" | "landscape" {
  if (orientation === "landscape") return "landscape";
  if (orientation === "portrait") return "portrait";

  const colSizes = grid.sizes?.cols ?? [];
  let width = 16; // smallest renderable width (padding + borders)
  for (let c = 0; c < grid.cols; c++) width += colSizes[c] ?? COLUMN_W;

  const rowSizes = grid.sizes?.rows ?? [];
  let height = PAGE_CHROME;
  for (let r = 0; r < grid.rows.length; r++) height += rowSizes[r] ?? ROW_H;

  const pw = width / (PAGE_W - PAGE_SIDE); // width fit on a portrait page
  const ph = height / (PAGE_H - PAGE_CHROME); // height fit on a portrait page
  const lw = width / (PAGE_H - PAGE_SIDE); // width fit on a landscape page
  const lh = height / (PAGE_W - PAGE_CHROME); // height fit on a landscape page

  const portraitOver = Math.max(pw, ph);
  const landscapeOver = Math.max(lw, lh);
  if (portraitOver <= 1 && landscapeOver <= 1) return "portrait"; // both fit

  const clipPenalty = (r: number) => Math.max(0, r - 1) * 0.8;
  const pScore = portraitOver + clipPenalty(pw);
  const lScore = landscapeOver + clipPenalty(lw);
  return lScore < pScore ? "landscape" : "portrait";
}

export type PdfOrientation = "auto" | "portrait" | "landscape";

export interface TablePdfDoc {
  id: string;
  name: string;
  section: string;
  color: string;
  cells: GridState;
  stickers: TableStickerPdf[];
  isDateBased: boolean;
}

export interface TableStickerPdf {
  id: string;
  sprite: string;
  x: number;
  y: number;
  w?: number;
  mirrored?: boolean;
  state?: "play" | "pause" | "frame2";
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Coerce a value that is about to be interpolated into an HTML attribute to a
 * finite number inside `[min, max]`, falling back to `fallback`. Keeps a
 * malformed or hostile stored value from breaking out of the attribute.
 */
export function numOr(value: unknown, fallback: number, min: number, max: number): number {
  /* Only a real number, or a string that parses cleanly to one, is accepted.
     `Number()` alone is too generous here: it maps null, "" and [] to 0, so a
     missing value would silently become the minimum instead of the fallback. */
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value);
  else return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** CIELAB-ish quick luminance (0..1) of a hex color — for ink choice. */
export function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0.3;
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Blend two hex colors: t = weight of a (1 → a, 0 → b). */
function mixHex(a: string, b: string, t: number): string {
  const expand = (hex: string) =>
    hex.replace(/^#/, "").length === 3
      ? hex
          .replace(/^#/, "")
          .split("")
          .map((c) => c + c)
      : hex.replace(/^#/, "").split("");
  const fa = expand(a);
  const fb = expand(b);
  const out = fa.map((c, i) => {
    const v = Math.round(parseInt(c, 16) * t + parseInt(fb[i], 16) * (1 - t));
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  });
  return "#" + out.join("");
}

export function buildTablePdfHtml({
  table,
  theme,
  includeStickers,
  orientation,
}: {
  table: TablePdfDoc;
  theme: PdfTheme;
  includeStickers: boolean;
  orientation?: PdfOrientation;
}): string {
  const p = PDF_PALETTE[theme];
  const accent = table.color || p.accent;
  const grid = table.cells;
  const rows = grid.rows;
  const today = new Date().toLocaleString("en-GB");

  /* A4 page model — portrait by default, flipping to landscape only when the
     table genuinely reads better wide (Auto), unless the caller forces one. */
  const landscape = resolvePdfOrientation(grid, orientation) === "landscape";
  const W = landscape ? 297 : 210;
  const H = landscape ? 210 : 297;

  /* Branded header band: accent-driven gradient, ink chosen for contrast. */
  const headerGrad =
    theme === "dark"
      ? `linear-gradient(135deg, ${accent} 0%, ${mixHex(accent, "#000000", 0.62)} 100%)`
      : `linear-gradient(135deg, ${mixHex(accent, "#0B2A1F", 0.45)} 0%, ${mixHex(accent, "#003532", 0.68)} 100%)`;
  const headerInk =
    theme === "dark"
      ? luminance(accent) > 0.55
        ? "rgba(6,11,20,0.85)"
        : "#FFFFFF"
      : "#FFFFFF";

  /* Today strip: date mode + matching YYYY-MM-DD cells → highlight the axis. */
  const stringGrid = rows.map((row) => row.map((c) => c?.v ?? null));
  const axis = table.isDateBased ? detectDateAxis(stringGrid, grid.cols) : null;
  const todayIdx = axis != null ? todayIndex(stringGrid, grid.cols, axis) : -1;
  const overlaps = (r: number, c: number, cell: { rs: number; cs: number }) =>
    axis === "cols"
      ? todayIdx >= 0 && c <= todayIdx && todayIdx < c + cell.cs
      : axis === "rows"
        ? todayIdx >= 0 && r <= todayIdx && todayIdx < r + cell.rs
        : false;

  /* Stickers: transparent sprites, frozen on their click-chosen pose.
     Server-side validation now bounds every sticker field, but this document is
     written into a SAME-ORIGIN iframe with `document.write`, so anything that
     reached the database before that validation existed would still execute
     with the user's session. Escape the text and coerce the numbers here too:
     the export is the last line of defence, not the first. */
  const stickerHtml =
    includeStickers && table.stickers.length > 0
      ? table.stickers
          .map((s) => {
            const size = numOr(s.w, 88, 40, 240);
            const left = numOr(s.x, 50, 0, 100);
            const top = numOr(s.y, 50, 0, 100);
            /* `sprite` becomes a URL segment. `encodeURIComponent` neutralizes
               quotes and path separators; the pattern in tablePayload keeps
               hostile values out of the database in the first place. */
            const src = `/rina/${encodeURIComponent(String(s.sprite ?? ""))}.webp`;
            const rot =
              s.state === "frame2"
                ? "rotate(5deg)"
                : s.state === "pause"
                  ? "rotate(-4deg)"
                  : "";
            const mir = s.mirrored ? "scaleX(-1)" : "";
            return `<img src="${esc(src)}" alt="" width="${size}" height="${size}"
              style="position:absolute;left:${left}%;top:${top}%;width:${size}px;height:${size}px;transform:translate(-50%,-50%) ${rot} ${mir};object-fit:contain;pointer-events:none;"/>
            `;
          })
          .join("")
      : "";

  /* Grid rows → <tr>. Covered cells (null) are skipped — spans fill them. */
  const body = rows
    .map((row, r) => {
      const tds = row
        .map((cell, c) => {
          if (cell === null) return "";
          const rs = cell.rs > 1 ? ` rowspan="${cell.rs}"` : "";
          const cs = cell.cs > 1 ? ` colspan="${cell.cs}"` : "";
          const merged = cell.rs > 1 || cell.cs > 1
            ? `font-weight:700;background:${theme === "light" ? "rgba(0,116,73,0.06)" : "rgba(0,232,162,0.08)"};`
            : "";
          const today = overlaps(r, c, cell)
            ? `background:${theme === "light" ? "rgba(0,116,73,0.13)" : "rgba(0,232,162,0.13)"};border-top:2px solid ${accent};`
            : "";
          const head = r === 0
            ? `background:${p.surface};font-weight:800;border-bottom:2px solid ${accent};`
            : c === 0
              ? "font-weight:700;"
              : "";
          return `<td${rs}${cs} style="padding:7px 9px;border:1px solid ${p.border};font-size:12px;line-height:1.45;vertical-align:top;color:${p.text};word-break:break-word;${head}${merged}${today}">${esc(cell.v)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en" class="${theme}" data-orientation="${landscape ? "landscape" : "portrait"}">
<head>
<meta charset="utf-8"/>
<title>${esc(table.name)} — Catarina</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body { width: ${W}mm; margin: 0; padding: 0; background-color: ${p.bg} !important; color: ${p.text} !important; }
  body { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; }
  .page { width: ${W}mm; min-height: ${H}mm; margin: 0; padding: 0; box-sizing: border-box; background-color: ${p.bg} !important; }
  @page { size: ${W}mm ${H}mm; margin: 0mm; background: ${p.bg}; }
  @media print { html, body, .page { background-color: ${p.bg} !important; } }

  /* Branded header band: full-bleed edge-to-edge (same treatment as the
     monthly report, minus the page padding). */
  .header { background: ${headerGrad}; padding: 18px 20px; color: ${headerInk}; }
  .header-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: .85; margin-bottom: 4px; }
  .header-title { font-size: 24px; font-weight: 900; line-height: 1.1; }
  .header-sub { font-size: 12px; margin-top: 3px; opacity: .9; }

  .section-title { font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 8px 12px 8px; padding-bottom: 6px; border-bottom: 2px solid ${accent}; color: ${accent}; }

  table.tgrid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .tgrid th, .tgrid td { vertical-align: top; text-align: left; }

  .footer { margin: 10px 12px 0; padding-top: 10px; border-top: 1px solid ${p.border}; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 12px; font-weight: 800; color: ${p.accent}; letter-spacing: 1px; }
  .footer-time { font-size: 11px; color: ${p.textMuted}; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-label">Team Table · Catarina</div>
    <div class="header-title">${esc(table.name)}</div>
    <div class="header-sub">${esc(table.section)} · ${grid.rows.length} rows × ${grid.cols} cols · Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
  </div>

  <div class="section-title">${esc(table.section)}</div>

  <div style="position:relative;">
    <table class="tgrid" style="margin:0 12px;width:calc(${W}mm - 24px);">
      <tbody>${body}</tbody>
    </table>
    ${stickerHtml}
  </div>

  <div class="footer">
    <div class="footer-brand">CATARINA</div>
    <div class="footer-time">Generated ${today}</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Compose the sticker accent visibility for a theme: on very light accents in
 * light mode we keep the raw hex; ink logic handled by the palette anyway.
 * Kept as a helper so callers can preview the accent treatment.
 */
export function accentInk(hex: string, theme: PdfTheme): string {
  const lum = luminance(hex);
  return theme === "light"
    ? lum > 0.55
      ? "#060B14"
      : hex
    : lum < 0.2
      ? hex
      : hex;
}