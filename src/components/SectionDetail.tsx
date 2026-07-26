"use client";

import Image from "next/image";
import GoalCard from "@/components/GoalCard";
import { calcSectionStats } from "@/lib/utils";
import { SECTION_COLORS } from "@/lib/auth";
import { type GoalData } from "@/types";

/**
 * Detailed section view within the archive — donut stats + goal cards.
 */
export default function SectionDetail({
  section,
  goals,
  stats,
  isAdmin,
  user,
}: {
  section: string;
  goals: GoalData[];
  stats: ReturnType<typeof calcSectionStats>;
  isAdmin: boolean;
  user: { id: string; sections: string[] } | null;
}) {
  const color = (SECTION_COLORS as Record<string, string>)[section] || "#00E8A2";

  return (
    <div className="space-y-4">
      {/* Section header card */}
      <div
        className="glass rounded-2xl overflow-hidden"
        style={{ borderColor: `${color}25` }}
      >
        <div className="h-1 w-full" style={{ backgroundColor: color, opacity: 0.6 }} />
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            <div className="text-center sm:text-right order-2 sm:order-1">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-text-muted font-semibold mb-1">
                Remaining
              </p>
              <p className="text-3xl sm:text-5xl font-black leading-none text-text-muted">
                {(100 - stats.percentage).toFixed(1)}
                <span className="text-2xl">%</span>
              </p>
              <p className="text-sm text-text-muted mt-1">
                {stats.remaining} goal{stats.remaining !== 1 ? "s" : ""} left
              </p>
            </div>
            <div className="relative order-1 sm:order-2 shrink-0 w-[160px] h-[160px] sm:w-[200px] sm:h-[200px]">
              <svg viewBox="0 0 232 232" className="w-full h-full transform -rotate-90" style={{ overflow: "visible" }}>
                <circle cx="116" cy="116" r="86" fill="none" stroke="var(--surface-2)" strokeWidth="18" />
                {stats.remaining > 0 && (
                  <circle
                    cx="116" cy="116" r="86" fill="none" stroke="var(--text-muted)"
                    strokeWidth="18"
                    strokeDasharray={`${((100 - stats.percentage) / 100) * 2 * Math.PI * 86} ${2 * Math.PI * 86}`}
                    strokeDashoffset={`${-(stats.percentage / 100) * 2 * Math.PI * 86}`}
                  />
                )}
                {stats.done > 0 && (
                  <circle
                    cx="116" cy="116" r="86" fill="none" stroke={color}
                    strokeWidth="18" strokeLinecap="round"
                    strokeDasharray={`${(stats.percentage / 100) * 2 * Math.PI * 86} ${2 * Math.PI * 86}`}
                    strokeDashoffset="0"
                    style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl sm:text-3xl font-black leading-none" style={{ color }}>
                  {stats.percentage.toFixed(1)}%
                </span>
                <span className="text-xs text-text-muted mt-0.5 font-medium">done</span>
              </div>
            </div>
            <div className="text-center sm:text-left order-3">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold mb-1" style={{ color }}>
                Done
              </p>
              <p className="text-3xl sm:text-5xl font-black leading-none" style={{ color }}>
                {stats.percentage.toFixed(1)}
                <span className="text-2xl">%</span>
              </p>
              <p className="text-sm mt-1" style={{ color: `${color}bb` }}>
                {stats.done} goal{stats.done !== 1 ? "s" : ""} done
              </p>
            </div>
          </div>
        </div>
        <div
          className="border-t px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5"
          style={{ borderColor: `${color}20`, backgroundColor: `${color}06` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Done</span>
            <span className="text-sm font-bold text-text">{stats.done}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Remaining</span>
            <span className="text-sm font-bold text-text">{stats.remaining}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Total</span>
            <span className="text-sm font-bold text-text">{stats.total}</span>
          </div>
        </div>
      </div>

      {/* Goals */}
      {goals.length === 0 ? (
        <div className="glass rounded-2xl text-center py-16 text-text-muted">
          <Image src="/rina/think.webp" alt="Catarina thinking" width={160} height={160} className="w-24 sm:w-40 h-auto mx-auto mb-5 drop-shadow-sm rounded-2xl" />
          <p className="text-sm font-semibold">No goals in this section</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              userId={user?.id || ""}
              isAdmin={isAdmin}
              permissions={{
                canEditGoals: isAdmin,
                canDeleteGoals: isAdmin,
              }}
              color={color}
              onToggle={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onComment={() => {}}
              onProgressChange={() => {}}
              onAutoComplete={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
