"use client";

/**
 * SectionChart — SVG-based 3D bar chart with animated bars.
 * Each bar grows from 0 to its target percentage on mount and when data changes.
 * Uses requestAnimationFrame for smooth 60fps animation.
 * Each bar is a proper 3D box built from three SVG polygons:
 *   - Front face  (section color, gradient top→bottom)
 *   - Right face  (darker, depth illusion)
 *   - Top face    (brightest, connects front top to right top)
 * Percentage labels float above each bars; section labels sit below the baseline.
 */

import { useEffect, useRef, useState } from "react";
import { calcSectionStats } from "@/lib/utils";
import Card from "@/components/ui/Card";
import { type SectionData, type DashboardGoal, FALLBACK_SECTIONS } from "@/types";

interface SectionChartProps {
  data: Record<string, Pick<DashboardGoal, "done" | "current" | "target">[]>;
  sections?: SectionData[];
}

/* ─── SVG layout constants ───────────────────────────────────────────────── */
const SVG_W      = 620;
const CHART_H    = 160;   // usable bar height
const PAD_L      = 44;    // room for Y-axis labels
const PAD_T      = 36;    // room for percentage labels above bars
const PAD_R      = 28;
const PAD_B      = 56;    // room for section labels below baseline
const DEPTH_X    = 22;    // 3-D horizontal depth
const DEPTH_Y    = 14;    // 3-D vertical depth
const MIN_BAR_H  = 4;     // minimum bar height so 0% still shows a 3D base
const SVG_H      = PAD_T + CHART_H + DEPTH_Y + PAD_B;

const BAR_AREA_W = SVG_W - PAD_L - PAD_R;

/* Points array → SVG points string */
const pts = (coords: [number, number][]) =>
  coords.map(([x, y]) => `${x},${y}`).join(" ");

/** ease-out swing: starts fast, decelerates smoothly */
const swingOut = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

export default function SectionChart({ data, sections: sectionsProp }: SectionChartProps) {
  const sectionDefs = sectionsProp || FALLBACK_SECTIONS;

  const sections = sectionDefs.map((s) => {
    const stats = calcSectionStats(data[s.key] || []);
    return {
      section: s.key,
      label: s.label,
      percentage: stats.percentage,
      done: stats.done,
      total: stats.total,
      color: s.color,
    };
  });

  /* Animated percentages — bars grow from 0 to target when in view */
  const targetPcts = sections.map((s) => s.percentage);
  const [animPcts, setAnimPcts] = useState(() => targetPcts.map(() => 0));
  const fromPctsRef = useRef(targetPcts.map(() => 0));
  const rafRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const DURATION = 2200;
  const DELAY = 600;

  /* Start bar animation when scrolled into view */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function runBarAnimation() {
      const from = fromPctsRef.current;
      const to = targetPcts;

      setTimeout(() => {
        const startTime = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - startTime) / DURATION, 1);
          setAnimPcts(to.map((v, i) => from[i] + (v - from[i]) * swingOut(t)));
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            fromPctsRef.current = to;
            setAnimPcts(to);
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }, DELAY);

      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          runBarAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* Re-animate when data changes after initial animation */
  useEffect(() => {
    if (!hasAnimated.current) return;
    const from = fromPctsRef.current;
    const to = targetPcts;
    if (to.every((t, i) => t === from[i])) return;

    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / DURATION, 1);
      setAnimPcts(to.map((v, i) => from[i] + (v - from[i]) * swingOut(t)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromPctsRef.current = to;
        setAnimPcts(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [targetPcts.join(",")]);

  const slotW  = BAR_AREA_W / sections.length;
  const barW   = slotW * 0.52;
  const barPad = (slotW - barW) / 2;

  /* Baseline Y (bottom of chart area, inside SVG coords) */
  const baseY = PAD_T + CHART_H;

  return (
    <Card className="w-full" ref={wrapperRef}>
      <h3 className="text-lg font-bold text-text mb-0.5">Section Completion</h3>
      <p className="text-xs text-text-muted mb-5">
        Completion percentage across all sections
      </p>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ minWidth: 300, display: "block" }}
          fontFamily="Inter, ui-sans-serif, sans-serif"
        >
          {/* ── Gradient defs ─────────────────────────────────────────── */}
          <defs>
            {sections.map(({ section, color }) => {
              const id = section.toLowerCase();
              return (
                <g key={id}>
                  {/* Front face gradient */}
                  <linearGradient id={`fg-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.48" />
                  </linearGradient>
                  {/* Right face gradient */}
                  <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity="0.55" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.18" />
                  </linearGradient>
                  {/* Top face gradient (left→right, lighter) */}
                  <linearGradient id={`tg-${id}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={color} stopOpacity="1"   />
                    <stop offset="100%" stopColor={color} stopOpacity="0.72" />
                  </linearGradient>
                  {/* Glow filter */}
                  <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </g>
              );
            })}
          </defs>

          {/* ── Y-axis grid lines ──────────────────────────────────────── */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = PAD_T + CHART_H - (pct / 100) * CHART_H;
            return (
              <g key={pct}>
                <line
                  x1={PAD_L} y1={y}
                  x2={SVG_W - PAD_R} y2={y}
                  stroke="var(--border)"
                  strokeDasharray="5 4"
                  strokeWidth="1"
                />
                <text
                  x={PAD_L - 6} y={y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontWeight="500"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* ── 3-D Bars ───────────────────────────────────────────────── */}
          {sections.map(({ section, label, color }, i) => {
            const clamped = Math.min(Math.max(animPcts[i] ?? 0, 0), 100);
            const barH    = (clamped / 100) * CHART_H;
            const id      = section.toLowerCase();

            /* Front face corners */
            const x0 = PAD_L + i * slotW + barPad; // left edge
            const x1 = x0 + barW;                   // right edge
            const yT = baseY - barH;                 // top of front face
            const yB = baseY;                        // bottom (baseline)

            /* 3-D offset corners */
            const dx = DEPTH_X, dy = DEPTH_Y;
            // Right face: fTR → rTR → rBR → fBR
            const rTR: [number, number] = [x1 + dx, yT - dy];
            const rBR: [number, number] = [x1 + dx, yB - dy];
            // Top face: fTL → tTL → rTR → fTR
            const tTL: [number, number] = [x0 + dx, yT - dy];

            const centerX = x0 + barW / 2;

            return (
              <g key={section}>
                {clamped > 0 ? (
                  <>
                    {/* ── Right face (draw first so front overlaps edge) ── */}
                    <polygon
                      points={pts([[x1, yT], rTR, rBR, [x1, yB]])}
                      fill={`url(#rg-${id})`}
                    />

                    {/* ── Front face ── */}
                    <polygon
                      points={pts([[x0, yT], [x1, yT], [x1, yB], [x0, yB]])}
                      fill={`url(#fg-${id})`}
                    />

                    {/* ── Top face (draw last, on top) ── */}
                    <polygon
                      points={pts([[x0, yT], tTL, rTR, [x1, yT]])}
                      fill={`url(#tg-${id})`}
                    />

                    {/* Subtle top-edge highlight line */}
                    <line
                      x1={x0} y1={yT}
                      x2={x1} y2={yT}
                      stroke={color}
                      strokeWidth="1.5"
                      opacity="0.65"
                    />

                    {/* Bottom glow shadow */}
                    <rect
                      x={x0 + 4} y={yB + 2}
                      width={barW - 8} height={6}
                      rx="3"
                      fill={color}
                      opacity="0.18"
                      style={{ filter: `blur(4px)` }}
                    />
                  </>
                ) : (
                  /* Empty bar — thin baseline hint */
                  <line
                    x1={x0} y1={yB}
                    x2={x1} y2={yB}
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.25"
                  />
                )}

                {/* Percentage label — floats above bar (or near baseline if 0) */}
                <text
                  x={centerX}
                  y={clamped > 0 ? yT - dy - 7 : yB - 8}
                  textAnchor="middle"
                  fill={color}
                  fontSize="11.5"
                  fontWeight="700"
                  style={{ filter: clamped > 0 ? `drop-shadow(0 0 6px ${color}80)` : undefined }}
                >
                  {clamped.toFixed(2)}%
                </text>

                {/* Section label — below baseline */}
                <text
                  x={centerX}
                  y={baseY + 18}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  fontWeight="600"
                  letterSpacing="0.8"
                >
                  COMPLETION IN
                </text>
                <text
                  x={centerX}
                  y={baseY + 32}
                  textAnchor="middle"
                  fill={color}
                  fontSize="9"
                  fontWeight="700"
                  letterSpacing="0.8"
                >
                  {label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* ── Baseline ───────────────────────────────────────────────── */}
          <line
            x1={PAD_L} y1={baseY}
            x2={SVG_W - PAD_R} y2={baseY}
            stroke="var(--border)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 justify-center">
        {sections.map(({ section, label, color, done, total }) => (
          <div key={section} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-text-muted">
              {label}
              <span className="ml-1 font-semibold text-text">
                {done}/{total}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
