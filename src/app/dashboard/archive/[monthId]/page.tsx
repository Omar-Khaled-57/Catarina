"use client";

/**
 * Archived Month Report — Multi-page report with Overview, Section details,
 * and Performance chart. PDF export via hidden iframe (hodor pattern)
 * with dark/light mode toggle in preview modal.
 *
 * Admin sees the full interactive pad.
 * Non-admin members see the report + export PDF.
 */

import { useState, useEffect, useMemo, use } from "react";
import { notFound } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SectionChart from "@/components/SectionChart";
import SectionDetail from "@/components/SectionDetail";
import { calcSectionStats, monthNameLine1, monthNameLine2, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { type GoalData } from "@/types";
import { SECTIONS, SECTION_COLORS, SECTION_LABELS } from "@/lib/auth";
import { PDF_PALETTE, type PdfTheme } from "@/lib/pdf-palette";
import {
  FileText, BarChart3, Layers, Sun, Moon, Download, X,
  CheckCircle2, Clock, Target, TrendingUp, ChevronRight
} from "lucide-react";

/* ─── Tab definitions ──────────────────────────────────────────────────── */
type TabId = "overview" | "sections" | "performance";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <FileText size={14} /> },
  { id: "sections", label: "Sections", icon: <Layers size={14} /> },
  { id: "performance", label: "Performance", icon: <BarChart3 size={14} /> },
];

/* ─── Page Component ───────────────────────────────────────────────────── */
export default function ArchivedMonthPage({
  params,
}: {
  params: Promise<{ monthId: string }>;
}) {
  const { monthId } = use(params);
  const teamName = process.env.NEXT_PUBLIC_TEAM_NAME || "Your Team";
  const { user, isAdmin } = useAuth();
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [monthInfo, setMonthInfo] = useState<{
    name: string;
    year: number;
    month: number;
    isArchived: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Tab state */
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  /* PDF export state */
  const [showExport, setShowExport] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<PdfTheme>("dark");

  useEffect(() => {
    fetch(`/api/goals?monthId=${monthId}`)
      .then((res) => res.json())
      .then((data) => setGoals(data.goals || []))
      .catch(() => { })
      .finally(() => setIsLoading(false));

    fetch("/api/months")
      .then((res) => res.json())
      .then((data) => {
        const found = data.months?.find(
          (m: { id: string }) => m.id === monthId
        );
        if (found) {
          setMonthInfo(found);
        } else {
          notFound();
        }
      })
      .catch(() => { notFound(); });
  }, [monthId]);

  /* Group goals by section */
  const goalsBySection = useMemo(
    () =>
      SECTIONS.reduce(
        (acc, section) => {
          acc[section] = goals.filter((g) => g.section === section);
          return acc;
        },
        {} as Record<string, GoalData[]>
      ),
    [goals]
  );

  /* Global stats */
  const globalStats = useMemo(() => {
    const total = goals.length;
    const done = goals.filter((g) => g.done).length;
    const remaining = total - done;
    const percentage =
      total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;
    return { total, done, remaining, percentage };
  }, [goals]);

  /* Section stats */
  const sectionStats = useMemo(
    () =>
      SECTIONS.reduce(
        (acc, section) => {
          acc[section] = calcSectionStats(goalsBySection[section]);
          return acc;
        },
        {} as Record<string, ReturnType<typeof calcSectionStats>>
      ),
    [goalsBySection]
  );

  /* ─── PDF Export (hodor-style iframe) ──────────────────────────────── */
  const handleExportPDF = () => {
    const p = PDF_PALETTE[pdfTheme];

    const sectionPages = SECTIONS.map((section) => {
      const sGoals = goalsBySection[section];
      const stats = sectionStats[section];
      const color = SECTION_COLORS[section];
      const label = SECTION_LABELS[section];

      const goalRows = sGoals
        .map(
          (g) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid ${p.border};font-weight:600;font-size:13px;color:${p.text};">${g.goalNumber}</td>
          <td style="padding:10px 14px;border-bottom:1px solid ${p.border};font-size:13px;color:${p.text};">${g.name}</td>
          <td style="padding:10px 14px;border-bottom:1px solid ${p.border};text-align:center;">
            <span style="background:${g.done ? "rgba(0,232,162,0.12)" : "rgba(255,184,48,0.12)"};color:${g.done ? p.accent : p.warning};font-weight:700;font-size:11px;padding:2px 10px;border-radius:999px;">${g.done ? "Done" : "Active"}</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid ${p.border};text-align:center;font-size:13px;color:${p.textMuted};">${g.current}/${g.target}</td>
          <td style="padding:10px 14px;border-bottom:1px solid ${p.border};text-align:center;font-size:13px;color:${p.textMuted};">${g.deadline ? formatDate(g.deadline) : "—"}</td>
        </tr>`
        )
        .join("");

      return `
      <div class="page" style="page-break-before:always;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:10px;height:10px;border-radius:3px;background:${color};"></div>
            <h2 style="font-size:18px;font-weight:800;color:${p.text};margin:0;">${label}</h2>
          </div>
          <div style="display:flex;gap:16px;font-size:12px;color:${p.textMuted};">
            <span>${stats.done} done</span>
            <span>${stats.remaining} remaining</span>
            <span style="font-weight:700;color:${color};">${stats.percentage.toFixed(1)}%</span>
          </div>
        </div>
        <div style="height:8px;background:${p.surface2};border-radius:999px;overflow:hidden;margin-bottom:16px;">
          <div style="height:100%;width:${stats.percentage}%;background:linear-gradient(90deg,${color},${color}cc);border-radius:999px;"></div>
        </div>
        ${sGoals.length > 0
          ? `<table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;color:${p.textMuted};background:${p.surface};border-bottom:2px solid ${p.border};">ID</th>
              <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;color:${p.textMuted};background:${p.surface};border-bottom:2px solid ${p.border};">Goal</th>
              <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center;color:${p.textMuted};background:${p.surface};border-bottom:2px solid ${p.border};">Status</th>
              <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center;color:${p.textMuted};background:${p.surface};border-bottom:2px solid ${p.border};">Progress</th>
              <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center;color:${p.textMuted};background:${p.surface};border-bottom:2px solid ${p.border};">Deadline</th>
            </tr>
          </thead>
          <tbody>${goalRows}</tbody>
        </table>`
          : `<p style="text-align:center;color:${p.textMuted};padding:24px;font-size:13px;">No goals in this section</p>`
        }
      </div>`;
    }).join("");

    /* Build inline SVG donut for the overview */
    const donutR = 70;
    const donutStroke = 14;
    const donutCirc = 2 * Math.PI * donutR;
    const doneLen = (globalStats.percentage / 100) * donutCirc;
    const remainLen = donutCirc - doneLen;
    const donutPad = 16;
    const donutOuter = (donutR + donutStroke / 2 + donutPad) * 2;
    const donutCx = donutOuter / 2;
    const donutCy = donutOuter / 2;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Report — ${monthInfo ? `${monthNameLine1(monthInfo.month, monthInfo.year)}` : "Archive"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background-color: ${p.bg} !important; color: ${p.text} !important; }
    body { font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.55; }
    .page { width: 210mm; min-height: 297mm; margin: 0; padding: 18mm 16mm 18mm; box-sizing: border-box; background-color: ${p.bg} !important; }
    @page { size: 210mm 297mm; margin: 0mm; background: ${p.bg}; }

    @media print {
      html, body { background-color: ${p.bg} !important; }
      .page { background-color: ${p.bg} !important; }
    }

    .header { background: linear-gradient(135deg, ${p.accent2} 0%, ${p.accent} 100%); padding: 30px 26px; border-radius: 14px; margin-bottom: 28px; }
    .header-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(6,11,20,0.6); margin-bottom: 8px; }
    .header-title { font-size: 30px; font-weight: 900; color: #060b14; line-height: 1.05; }
    .header-sub { font-size: 13px; color: rgba(6,11,20,0.5); margin-top: 4px; }

    .stats-row { display: flex; gap: 14px; margin-bottom: 24px; }
    .stat { flex: 1; border-radius: 14px; padding: 20px 16px; text-align: center; }
    .stat-num { font-size: 32px; font-weight: 900; }
    .stat-label { font-size: 11px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }

    .donut-wrap { display: flex; justify-content: center; margin-bottom: 30px; }

    .section-title { font-size: 13px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid; }

    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
    td { padding: 12px 14px; font-size: 12px; color: ${p.text}; }

    .footer { margin-top: 38px; padding-top: 20px; border-top: 1px solid ${p.border}; display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { font-size: 12px; font-weight: 800; color: ${p.accent}; letter-spacing: 1px; }
    .footer-time { font-size: 11px; color: ${p.textMuted}; }
  </style>
</head>
<body>
  <!-- PAGE 1: OVERVIEW -->
  <div class="page">
    <div class="header">
      <div class="header-label">Monthly Report · Catarina</div>
      <div class="header-title">${monthInfo ? `${monthNameLine1(monthInfo.month, monthInfo.year)} — ${monthNameLine2(monthInfo.month)}` : "Archive Report"}</div>
      <div class="header-sub">${goals.length} total goals across ${SECTIONS.length} sections · Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
    </div>

    <div class="stats-row">
      <div class="stat" style="background:${p.surface};border:1.5px solid ${p.border};">
        <div class="stat-num" style="color:${p.text};">${globalStats.total}</div>
        <div class="stat-label" style="color:${p.textMuted};">Total Goals</div>
      </div>
      <div class="stat" style="background:rgba(0,232,162,0.08);border:1.5px solid ${p.accent}40;">
        <div class="stat-num" style="color:${p.accent};">${globalStats.done}</div>
        <div class="stat-label" style="color:${p.textMuted};">Done</div>
      </div>
      <div class="stat" style="background:rgba(255,184,48,0.08);border:1.5px solid ${p.warning}40;">
        <div class="stat-num" style="color:${p.warning};">${globalStats.remaining}</div>
        <div class="stat-label" style="color:${p.textMuted};">Remaining</div>
      </div>
      <div class="stat" style="background:${p.surface};border:1.5px solid ${p.border};">
        <div class="stat-num" style="color:${p.accent};">${globalStats.percentage.toFixed(1)}%</div>
        <div class="stat-label" style="color:${p.textMuted};">Completion</div>
      </div>
    </div>

    <div class="donut-wrap">
      <svg viewBox="0 0 ${donutOuter} ${donutOuter}" width="160" height="160" style="transform:rotate(-90deg);">
        <circle cx="${donutCx}" cy="${donutCy}" r="${donutR}" fill="none" stroke="${p.surface2}" stroke-width="${donutStroke}" />
        ${remainLen > 0 ? `<circle cx="${donutCx}" cy="${donutCy}" r="${donutR}" fill="none" stroke="${p.textMuted}" stroke-width="${donutStroke}" stroke-dasharray="${remainLen} ${donutCirc - remainLen}" stroke-dashoffset="${-doneLen}" />` : ""}
        ${doneLen > 0 ? `<circle cx="${donutCx}" cy="${donutCy}" r="${donutR}" fill="none" stroke="${p.accent}" stroke-width="${donutStroke}" stroke-linecap="round" stroke-dasharray="${doneLen} ${donutCirc - doneLen}" stroke-dashoffset="0" />` : ""}
        <text x="${donutCx}" y="${donutCy - 4}" text-anchor="middle" fill="${p.accent}" font-size="22" font-weight="900" style="transform:rotate(90deg);transform-origin:center;">${globalStats.percentage.toFixed(1)}%</text>
        <text x="${donutCx}" y="${donutCy + 14}" text-anchor="middle" fill="${p.textMuted}" font-size="10" font-weight="600" style="transform:rotate(90deg);transform-origin:center;">done</text>
      </svg>
    </div>

    <div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${p.textMuted};margin-bottom:12px;">Section Breakdown</div>
      ${SECTIONS.map((section) => {
      const stats = sectionStats[section];
      const color = SECTION_COLORS[section];
      const label = SECTION_LABELS[section];
      return `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="width:10px;height:10px;border-radius:3px;background:${color};flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:12px;font-weight:600;color:${p.text};">${label}</span>
              <span style="font-size:12px;font-weight:700;color:${color};">${stats.percentage.toFixed(1)}%</span>
            </div>
            <div style="height:6px;background:${p.surface2};border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${stats.percentage}%;background:${color};border-radius:999px;"></div>
            </div>
          </div>
          <span style="font-size:11px;color:${p.textMuted};white-space:nowrap;">${stats.done}/${stats.total}</span>
        </div>`;
    }).join("")}
    </div>
  </div>

  <!-- PAGES 2–5: PER SECTION -->
  ${sectionPages}

  <!-- PAGE 6: PERFORMANCE CHART (rendered as static bars for PDF) -->
  <div class="page" style="page-break-before:always;">
    <div style="margin-bottom:20px;">
      <div class="section-title" style="color:${p.accent};border-color:${p.accent};">Performance · Completion Chart</div>
      <p style="font-size:12px;color:${p.textMuted};margin-bottom:20px;">Completion percentage across all sections</p>
    </div>
    <svg viewBox="0 0 620 320" width="100%" style="display:block;" font-family="Inter, sans-serif">
      ${(() => {
        const SVG_W = 620;
        const CHART_H = 180;
        const PAD_L = 44;
        const PAD_T = 36;
        const PAD_R = 28;
        const DEPTH_X = 22;
        const DEPTH_Y = 14;
        const BAR_AREA_W = SVG_W - PAD_L - PAD_R;
        const slotW = BAR_AREA_W / SECTIONS.length;
        const barW = slotW * 0.52;
        const barPad = (slotW - barW) / 2;
        const baseY = PAD_T + CHART_H;
        const pts = (coords: [number, number][]) => coords.map(([x, y]) => `${x},${y}`).join(" ");

        /* Grid lines */
        const grid = [0, 25, 50, 75, 100]
          .map((pct) => {
            const y = PAD_T + CHART_H - (pct / 100) * CHART_H;
            return `<line x1="${PAD_L}" y1="${y}" x2="${SVG_W - PAD_R}" y2="${y}" stroke="${p.border}" stroke-dasharray="5 4" stroke-width="1" />
              <text x="${PAD_L - 6}" y="${y + 4}" text-anchor="end" fill="${p.textMuted}" font-size="10" font-weight="500">${pct}%</text>`;
          })
          .join("");

        /* Bars */
        const bars = SECTIONS.map((section, i) => {
          const stats = sectionStats[section];
          const color = SECTION_COLORS[section];
          const label = SECTION_LABELS[section];
          const pct = stats.percentage;
          const barH = (pct / 100) * CHART_H;
          const x0 = PAD_L + i * slotW + barPad;
          const x1 = x0 + barW;
          const yT = baseY - barH;
          const yB = baseY;
          const dx = DEPTH_X;
          const dy = DEPTH_Y;
          const centerX = x0 + barW / 2;

          return `
            <polygon points="${pts([[x1, yT], [x1 + dx, yT - dy], [x1 + dx, yB - dy], [x1, yB]])}" fill="${color}" opacity="0.4" />
            <polygon points="${pts([[x0, yT], [x1, yT], [x1, yB], [x0, yB]])}" fill="${color}" opacity="0.8" />
            <polygon points="${pts([[x0, yT], [x0 + dx, yT - dy], [x1 + dx, yT - dy], [x1, yT]])}" fill="${color}" opacity="1" />
            <line x1="${x0}" y1="${yT}" x2="${x1}" y2="${yT}" stroke="${color}" stroke-width="1.5" opacity="0.6" />
            <text x="${centerX}" y="${yT - dy - 7}" text-anchor="middle" fill="${color}" font-size="11" font-weight="700">${pct.toFixed(1)}%</text>
            <text x="${centerX}" y="${baseY + 18}" text-anchor="middle" fill="${p.textMuted}" font-size="8.5" font-weight="600" letter-spacing="0.8">COMPLETION IN</text>
            <text x="${centerX}" y="${baseY + 32}" text-anchor="middle" fill="${color}" font-size="9" font-weight="700" letter-spacing="0.8">${label.toUpperCase()}</text>`;
        }).join("");

        return `
          <defs>
            ${SECTIONS.map((section) => {
          const id = section.toLowerCase();
          const color = SECTION_COLORS[section];
          return `
              <linearGradient id="pfg-${id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.95" />
                <stop offset="100%" stop-color="${color}" stop-opacity="0.48" />
              </linearGradient>
              <linearGradient id="prg-${id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.55" />
                <stop offset="100%" stop-color="${color}" stop-opacity="0.18" />
              </linearGradient>
              <linearGradient id="ptg-${id}" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="${color}" stop-opacity="1" />
                <stop offset="100%" stop-color="${color}" stop-opacity="0.72" />
              </linearGradient>`;
        }).join("")}
          </defs>
          ${grid}
          ${bars}
          <line x1="${PAD_L}" y1="${baseY}" x2="${SVG_W - PAD_R}" y2="${baseY}" stroke="${p.textMuted}" stroke-width="1.5" opacity="0.3" />`;
      })()}
    </svg>
  </div>

    <div class="footer">
      <div class="footer-brand">CATARINA · by ${teamName}</div>
      <div class="footer-time">Generated ${new Date().toLocaleString("en-GB")}</div>
    </div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;opacity:0;pointer-events:none;z-index:-9999;";
    document.body.appendChild(iframe);
    iframe.contentDocument!.open();
    iframe.contentDocument!.write(html);
    iframe.contentDocument!.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow!.focus();
        iframe.contentWindow!.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
  };

  /* ─── Loading state ──────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const monthLabel = monthInfo
    ? `${monthNameLine1(monthInfo.month, monthInfo.year)}`
    : "Archived Month";
  const monthSub = monthInfo ? monthNameLine2(monthInfo.month) : "";

  return (
    <div className="space-y-6 px-4 sm:px-5 lg:px-6 py-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-text tracking-tight">
            {monthLabel}
            {monthSub && (
              <>
                <br />
                <span className="text-sm font-medium text-text-muted">
                  {monthSub}
                </span>
              </>
            )}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {goals.length} total goals across {SECTIONS.length} sections
          </p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg shadow-[0_0_15px_var(--color-accent-glow)] transition-transform hover:scale-105 active:scale-95"
        >
          <Download size={16} />
          Export PDF
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-surface border border-border p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "sections" && !activeSection) {
                setActiveSection(SECTIONS[0]);
              }
            }}
            className={`min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${activeTab === tab.id
                ? "bg-accent text-bg shadow-md"
                : "text-text-muted hover:text-text hover:bg-surface-2"
              }`}
          >
            {tab.icon}
            <span className="max-w-full truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ── OVERVIEW ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Total Goals",
                  value: globalStats.total,
                  color: "var(--text)",
                  bg: "bg-surface-2/50",
                  border: "border-border/40",
                  icon: <Target size={18} />,
                },
                {
                  label: "Done",
                  value: globalStats.done,
                  color: "#00E8A2",
                  bg: "bg-accent/10",
                  border: "border-accent/20",
                  icon: <CheckCircle2 size={18} />,
                },
                {
                  label: "Remaining",
                  value: globalStats.remaining,
                  color: "#FFB830",
                  bg: "bg-warning/10",
                  border: "border-warning/20",
                  icon: <Clock size={18} />,
                },
                {
                  label: "Completion",
                  value: `${globalStats.percentage.toFixed(1)}%`,
                  color: "var(--accent)",
                  bg: "bg-accent/10",
                  border: "border-accent/20",
                  icon: <TrendingUp size={18} />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`glass rounded-xl p-4 ${stat.bg} ${stat.border}`}
                >
                  <div
                    className="flex items-center gap-2 mb-2"
                    style={{ color: stat.color }}
                  >
                    {stat.icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {stat.label}
                    </span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Donut + Section Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Donut */}
              <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">
                  Overall Completion
                </p>
                <div className="relative w-[180px] h-[180px]">
                  <svg viewBox="0 0 212 212" className="w-full h-full transform -rotate-90" style={{ overflow: "visible" }}>
                    <circle cx="106" cy="106" r="80" fill="none" stroke="var(--surface-2)" strokeWidth="18" />
                    {globalStats.remaining > 0 && (
                      <circle
                        cx="106" cy="106" r="80" fill="none" stroke="var(--text-muted)"
                        strokeWidth="18"
                        strokeDasharray={`${(100 - globalStats.percentage) / 100 * 2 * Math.PI * 80} ${2 * Math.PI * 80}`}
                        strokeDashoffset={`${-(globalStats.percentage / 100) * 2 * Math.PI * 80}`}
                      />
                    )}
                    {globalStats.done > 0 && (
                      <circle
                        cx="106" cy="106" r="80" fill="none" stroke="var(--accent)"
                        strokeWidth="18" strokeLinecap="round"
                        strokeDasharray={`${(globalStats.percentage / 100) * 2 * Math.PI * 80} ${2 * Math.PI * 80}`}
                        strokeDashoffset="0"
                        style={{ filter: "drop-shadow(0 0 8px rgba(0,232,162,0.4))" }}
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-accent leading-none">
                      {globalStats.percentage.toFixed(1)}%
                    </span>
                    <span className="text-xs text-text-muted mt-0.5 font-medium">done</span>
                  </div>
                </div>
              </div>

              {/* Section bars */}
              <div className="glass rounded-2xl p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4">
                  Section Breakdown
                </p>
                <div className="space-y-3">
                  {SECTIONS.map((section) => {
                    const stats = sectionStats[section];
                    const color = SECTION_COLORS[section];
                    const label = SECTION_LABELS[section];
                    return (
                      <div key={section}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-[3px]"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-semibold text-text">
                              {label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted">
                              {stats.done}/{stats.total}
                            </span>
                            <span
                              className="text-xs font-bold"
                              style={{ color }}
                            >
                              {stats.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${stats.percentage}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SECTIONS ──────────────────────────────────────────────── */}
        {activeTab === "sections" && (
          <motion.div
            key="sections"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Section tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {SECTIONS.map((section) => {
                const color = SECTION_COLORS[section];
                const label = SECTION_LABELS[section];
                const isActive = activeSection === section;
                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${isActive
                        ? "text-bg"
                        : "text-text-muted hover:text-text border-transparent hover:border-border/40"
                      }`}
                    style={
                      isActive
                        ? { backgroundColor: color, borderColor: color }
                        : {}
                    }
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${isActive ? 'ring-2 ring-bg/50' : ''}`}
                      style={{ backgroundColor: isActive ? 'var(--bg)' : color }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Active section content */}
            {activeSection && (
              <SectionDetail
                section={activeSection}
                goals={goalsBySection[activeSection]}
                stats={sectionStats[activeSection]}
                isAdmin={isAdmin}
                user={user}
              />
            )}
          </motion.div>
        )}

        {/* ── PERFORMANCE ───────────────────────────────────────────── */}
        {activeTab === "performance" && (
          <motion.div
            key="performance"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <SectionChart data={goalsBySection} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Export PDF Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExport(false)}
              className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Export PDF
                  </p>
                  <h2 className="text-lg font-black text-text mt-0.5">
                    {monthLabel}
                    {monthSub && (
                      <span className="text-xs font-medium text-text-muted ml-2">
                        {monthSub}
                      </span>
                    )}
                  </h2>
                </div>
                <button
                  onClick={() => setShowExport(false)}
                  className="rounded-xl p-2 text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 space-y-5">
                {/* Theme selector */}
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                    Color Theme
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPdfTheme("dark")}
                      className={`relative flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${pdfTheme === "dark"
                          ? "border-accent bg-accent/5"
                          : "border-border/40 hover:border-border"
                        }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D1824] border border-[rgba(0,232,162,0.15)]">
                        <Moon size={16} className="text-[#00E8A2]" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-text">Dark</p>
                        <p className="text-[10px] text-text-muted">
                          Neon teal on dark
                        </p>
                      </div>
                      {pdfTheme === "dark" && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 size={14} className="text-accent" />
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => setPdfTheme("light")}
                      className={`relative flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${pdfTheme === "light"
                          ? "border-accent bg-accent/5"
                          : "border-border/40 hover:border-border"
                        }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0F6FF] border border-[rgba(0,196,122,0.3)]">
                        <Sun size={16} className="text-[#00C47A]" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-text">Light</p>
                        <p className="text-[10px] text-text-muted">
                          Clean white background
                        </p>
                      </div>
                      {pdfTheme === "light" && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 size={14} className="text-accent" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Report summary */}
                <div className="rounded-xl bg-surface-2/50 border border-border/30 p-4">
                  <p className="text-xs font-semibold text-text-muted mb-2">
                    Report includes:
                  </p>
                  <div className="space-y-1.5">
                    {[
                      "Overview with donut chart and stats",
                      ...SECTIONS.map(
                        (s) => `${SECTION_LABELS[s]} — ${sectionStats[s].percentage.toFixed(1)}%`
                      ),
                      "Performance completion chart",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-text">
                        <ChevronRight size={12} className="text-accent shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export button */}
                <button
                  onClick={() => {
                    handleExportPDF();
                    setShowExport(false);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-bg shadow-[0_0_15px_var(--color-accent-glow)] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Download size={16} />
                  Save as PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
