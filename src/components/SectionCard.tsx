"use client";

/**
 * SectionCard — Dashboard card showing section-level stats.
 * Displays completion percentage, done/remaining counts,
 * and a progress bar with section-specific color.
 */

import Link from "next/link";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import CountUp from "@/components/ui/CountUp";
import { calcSectionStats } from "@/lib/utils";
import { type DashboardGoal } from "@/types";
import { Activity, Palette, Code2, Users } from "lucide-react";

interface SectionCardProps {
  section: string;
  goals: Pick<DashboardGoal, "id" | "done" | "current" | "target">[];
  highlight?: boolean;
  color?: string;
  label?: string;
  hasNewActivity?: boolean;
}

export default function SectionCard({ section, goals, highlight, color: colorProp, label: labelProp, hasNewActivity }: SectionCardProps) {
  const stats = calcSectionStats(goals);
  const color = colorProp || "#00E8A2";
  const label = labelProp || section;

  return (
    <Link href={`/dashboard/${section.toLowerCase()}`}>
      <Card
        hover
        className={`h-full transition-shadow duration-500 ${
          highlight ? "ring-2 shadow-lg" : ""
        } ${hasNewActivity ? "animate-section-pulse" : ""}`}
        aria-label={`${label}${hasNewActivity ? " — new activity" : ""}`}
        style={{
          ...(highlight ? { boxShadow: `0 0 28px ${color}40`, borderColor: `${color}60`, "--tw-ring-color": `${color}50` } as React.CSSProperties : {}),
          ...(hasNewActivity ? { borderColor: `${color}60`, "--pulse-color": `${color}80` } as React.CSSProperties : {}),
        }}
      >
        {/* Section Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex min-w-0 items-center gap-3">
            <SectionIcon section={section} color={color} />
            <h3 className="min-w-0 text-lg font-bold text-text break-words">{label}</h3>
          </div>
          <div className="flex shrink-0 flex-col-reverse items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            {highlight && (
              <span
                className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
              >
                Your Section
              </span>
            )}
            <Badge variant="section" section={section} className="whitespace-nowrap">
              {stats.total} goals
            </Badge>
          </div>
        </div>

        {/* Completion Percentage — Large Display */}
        <div className="mb-4">
          <CountUp
            value={stats.percentage}
            decimals={1}
            suffix="%"
            delay={300}
            duration={2200}
            className="text-4xl font-black"
            style={{ color } as React.CSSProperties}
          />
          <span className="text-sm text-text-muted ml-2">completion</span>
        </div>

        {/* Progress Bar */}
        <ProgressBar
          value={stats.percentage}
          color={color}
          className="mb-4"
          animateOnMount
          delay={300}
          duration={2200}
        />

        {/* Stats Row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-text-muted">
              Done: <CountUp value={stats.done} delay={500} duration={1600} className="font-semibold text-text" />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-surface-2" />
            <span className="text-sm text-text-muted">
              Remaining:{" "}
              <CountUp value={stats.remaining} delay={650} duration={1600} className="font-semibold text-text" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ─── Section Icon Helper ─────────────────────────────────────────────────── */
function SectionIcon({ section, color }: { section: string; color?: string }) {
  const resolvedColor = color || "#00E8A2";

  const icons: Record<string, React.ReactNode> = {
    MARKETING: <Activity size={20} style={{ color: resolvedColor }} />,
    ART: <Palette size={20} style={{ color: resolvedColor }} />,
    TECHNICAL: <Code2 size={20} style={{ color: resolvedColor }} />,
    MANAGEMENT: <Users size={20} style={{ color: resolvedColor }} />,
  };

  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-xl"
      style={{
        backgroundColor: `${resolvedColor}15`,
        border: `1px solid ${resolvedColor}30`,
      }}
    >
      {icons[section] || <Activity size={20} style={{ color: resolvedColor }} />}
    </div>
  );
}
