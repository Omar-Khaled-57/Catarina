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
import { SECTION_COLORS, type Section } from "@/lib/auth";
import { calcSectionStats } from "@/lib/utils";
import { Activity, Palette, Code2, Users } from "lucide-react";

interface Goal {
  id: string;
  done: boolean;
  current: number;
  target: number;
}

interface SectionCardProps {
  section: Section;
  goals: Goal[];
  highlight?: boolean;
}

export default function SectionCard({ section, goals, highlight }: SectionCardProps) {
  const stats = calcSectionStats(goals);
  const color = SECTION_COLORS[section];

  return (
    <Link href={`/dashboard/${section.toLowerCase()}`}>
      <Card
        hover
        className={`h-full transition-shadow duration-500 ${
          highlight ? "ring-2 shadow-lg" : ""
        }`}
        style={highlight ? { boxShadow: `0 0 28px ${color}40`, borderColor: `${color}60`, "--tw-ring-color": `${color}50` } as React.CSSProperties : undefined}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <SectionIcon section={section} />
            <h3 className="text-lg font-bold text-text">{section}</h3>
          </div>
          <div className="flex items-center gap-2">
            {highlight && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
              >
                Your Section
              </span>
            )}
            <Badge variant="section" section={section}>
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
        <ProgressBar value={stats.percentage} color={color} className="mb-4" />

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
function SectionIcon({ section }: { section: Section }) {
  const color = SECTION_COLORS[section];

  const icons: Record<Section, React.ReactNode> = {
    MARKETING: <Activity size={20} style={{ color }} />,
    ART: <Palette size={20} style={{ color }} />,
    TECHNICAL: <Code2 size={20} style={{ color }} />,
    MANAGEMENT: <Users size={20} style={{ color }} />,
  };

  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-xl"
      style={{
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      {icons[section]}
    </div>
  );
}
