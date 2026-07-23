// Shared Utility Functions

import { type ClassValue, clsx } from "clsx";

/**
 * Merges class names using clsx.
 * Handles conditional classes and arrays cleanly.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Calculates goal completion percentage based on current/target values.
 * Returns a value between 0 and 100.
 */
export function calcPercentage(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

/**
 * Formats a date string to dd/mm/yy.
 * Example: "31/07/26"
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Returns a short date format (e.g. "31 Jul").
 */
export function formatDateShort(date: string | Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${day} ${month}`;
}

/**
 * Determines deadline urgency for styling/alerts.
 * - "overdue": deadline has passed and goal is not done
 * - "urgent": deadline is within 3 days
 * - "normal": deadline is more than 3 days away
 */
export function deadlineStatus(
  deadline: string | Date,
  done: boolean
): "overdue" | "urgent" | "normal" {
  if (done) return "normal";
  const now = new Date();
  const dl = new Date(deadline);
  const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "urgent";
  return "normal";
}

/**
 * Calculates section-level statistics from an array of goals.
 */
export function calcSectionStats(goals: { done: boolean; current: number; target: number }[]) {
  const total = goals.length;
  const done = goals.filter((g) => g.done).length;
  const remaining = total - done;
  const percentage = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;
  return { total, done, remaining, percentage };
}

/**
 * Month display in two-line format:
 * Line 1: "July / 2026"
 * Line 2: "month - 07"
 */
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function monthName(month: number, year: number): string {
  const m = String(month).padStart(2, "0");
  const full = MONTH_NAMES[month - 1] || "";
  return `${full} / ${year}\nmonth - ${m}`;
}

export function monthNameLine1(month: number, year: number): string {
  const full = MONTH_NAMES[month - 1] || "";
  return `${full} / ${year}`;
}

export function monthNameLine2(month: number): string {
  const m = String(month).padStart(2, "0");
  return `month - ${m}`;
}

/**
 * Gets the current month and year.
 */
export function getCurrentMonth(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Returns the default PFP path for a given section.
 * Falls back to a colored initial (null) if no image exists.
 */
const SECTION_PFP: Record<string, string> = {
  ART: "/pfps/art.png",
  MANAGEMENT: "/pfps/mng.gif",
  TECHNICAL: "/pfps/tec.gif",
  MARKETING: "/pfps/mrk.gif",
};

export function getDefaultPfp(section: string): string | null {
  return SECTION_PFP[section] || null;
}
