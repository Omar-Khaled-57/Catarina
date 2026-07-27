"use client";

/**
 * NotificationModal — Expanded view of a single notification.
 * Shows full title/message, type-specific actions (view goal, celebrate),
 * and rich media (images, audio players).
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import MonthCelebrationModal from "@/components/MonthCelebrationModal";
import { AudioPlayer } from "@/components/NotificationPanel";
import { type GoalData } from "@/types";
import changelog from "@/lib/changelog.json";
import Image from "next/image";
import {
  Target,
  UserPlus,
  Clock,
  AlertTriangle,
  Award,
  FileText,
  Info,
  Trophy,
  MessageCircle,
  UserMinus,
  UserX,
  CalendarPlus,
  ArrowRightLeft,
  Shield,
  Bell,
  ArrowRight,
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  pinned: boolean;
  refId: string | null;
  refType: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, typeof Bell> = {
  GOAL_CREATED: Target,
  STEP_ADDED: FileText,
  MEMBER_JOINED: UserPlus,
  SIGNUP_REQUEST: UserPlus,
  DEADLINE_APPROACHING: Clock,
  DEADLINE_MISSED: AlertTriangle,
  GOAL_COMPLETED: Award,
  SYSTEM: Info,
  GOAL_REACHED: Trophy,
  COMMENT_ADDED: MessageCircle,
  MEMBER_LEFT_SECTION: UserMinus,
  MEMBER_DELETED: UserX,
  MONTH_CREATED: CalendarPlus,
  GOALS_CARRIED_OVER: ArrowRightLeft,
  ROLE_CHANGED: Shield,
  SIGNUP_REJECTED: AlertTriangle,
  VERSION_UPDATE: Info,
};

const TYPE_COLOR: Record<string, string> = {
  GOAL_CREATED: "text-accent",
  STEP_ADDED: "text-technical",
  MEMBER_JOINED: "text-management",
  SIGNUP_REQUEST: "text-management",
  DEADLINE_APPROACHING: "text-warning",
  DEADLINE_MISSED: "text-danger",
  GOAL_COMPLETED: "text-accent",
  SYSTEM: "text-text-muted",
  GOAL_REACHED: "text-accent",
  COMMENT_ADDED: "text-technical",
  MEMBER_LEFT_SECTION: "text-danger",
  MEMBER_DELETED: "text-danger",
  MONTH_CREATED: "text-management",
  GOALS_CARRIED_OVER: "text-warning",
  ROLE_CHANGED: "text-art",
  SIGNUP_REJECTED: "text-danger",
  VERSION_UPDATE: "text-accent",
};

const TYPE_BG: Record<string, string> = {
  GOAL_CREATED: "bg-accent/10",
  STEP_ADDED: "bg-technical/10",
  MEMBER_JOINED: "bg-management/10",
  SIGNUP_REQUEST: "bg-management/10",
  DEADLINE_APPROACHING: "bg-warning/10",
  DEADLINE_MISSED: "bg-danger/10",
  GOAL_COMPLETED: "bg-accent/10",
  SYSTEM: "bg-surface-2/50",
  GOAL_REACHED: "bg-accent/10",
  COMMENT_ADDED: "bg-technical/10",
  MEMBER_LEFT_SECTION: "bg-danger/10",
  MEMBER_DELETED: "bg-danger/10",
  MONTH_CREATED: "bg-management/10",
  GOALS_CARRIED_OVER: "bg-warning/10",
  ROLE_CHANGED: "bg-art/10",
  SIGNUP_REJECTED: "bg-danger/10",
  VERSION_UPDATE: "bg-accent/10",
};

const TYPE_LABEL: Record<string, string> = {
  GOAL_CREATED: "Goal Created",
  STEP_ADDED: "Step Added",
  MEMBER_JOINED: "Member Joined",
  SIGNUP_REQUEST: "Signup Request",
  DEADLINE_APPROACHING: "Deadline Approaching",
  DEADLINE_MISSED: "Deadline Missed",
  GOAL_COMPLETED: "Goal Completed",
  SYSTEM: "System",
  GOAL_REACHED: "Goal Reached",
  COMMENT_ADDED: "Comment Added",
  MEMBER_LEFT_SECTION: "Member Left",
  MEMBER_DELETED: "Member Deleted",
  MONTH_CREATED: "New Month",
  GOALS_CARRIED_OVER: "Goals Carried Over",
  ROLE_CHANGED: "Role Changed",
  SIGNUP_REJECTED: "Signup Rejected",
  VERSION_UPDATE: "Version Update",
};

const TYPE_IMAGE: Record<string, string> = {
  GOAL_CREATED: "/rina/edit.webp",
  STEP_ADDED: "/rina/edit.webp",
  DEADLINE_APPROACHING: "/rina/dealine.webp",
  DEADLINE_MISSED: "/rina/deadline.webp",
  SYSTEM: "/rina/happy.webp",
  COMMENT_ADDED: "/rina/note.webp",
  ROLE_CHANGED: "/rina/role-changed.webp",
  GOAL_REACHED: "/rina/excited.webp",
  GOAL_COMPLETED: "/rina/excited.webp",
  MEMBER_JOINED: "/rina/excited.webp",
  SIGNUP_REQUEST: "/rina/thumb.webp",
  SIGNUP_REJECTED: "/rina/cry.webp",
  MEMBER_LEFT_SECTION: "/rina/cry.webp",
  MEMBER_DELETED: "/rina/bye.webp",
  VERSION_UPDATE: "/rina/update.webp",
  GOALS_CARRIED_OVER: "/rina/cry.webp",
};

/** Notification types that relate to a goal (refType === "goal") */
const GOAL_TYPES = new Set([
  "GOAL_CREATED",
  "STEP_ADDED",
  "DEADLINE_APPROACHING",
  "DEADLINE_MISSED",
  "GOAL_COMPLETED",
  "GOAL_REACHED",
  "COMMENT_ADDED",
]);

/** Notification types that trigger the celebration modal */
const CELEBRATION_TYPES = new Set(["MONTH_CREATED", "GOALS_CARRIED_OVER"]);

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function fullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationModal({
  notification,
  isOpen,
  onClose,
  onPanelClose,
}: {
  notification: Notification | null;
  isOpen: boolean;
  onClose: () => void;
  onPanelClose?: () => void;
}) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [goalData, setGoalData] = useState<GoalData | null>(null);
  const [loadingGoal, setLoadingGoal] = useState(false);

  const isGoal = GOAL_TYPES.has(notification?.type || "") && notification?.refType === "goal";

  /* Fetch full goal data when modal opens for goal notifications */
  useEffect(() => {
    if (!isOpen || !isGoal || !notification?.refId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale data on open/close
      setGoalData(null);
      return;
    }
    setLoadingGoal(true);
    fetch(`/api/goals/${notification.refId}`)
      .then((r) => r.json())
      .then((d) => setGoalData(d.goal || null))
      .catch(() => setGoalData(null))
      .finally(() => setLoadingGoal(false));
  }, [isOpen, isGoal, notification?.refId]);

  const handleNavigateToGoal = useCallback(async () => {
    if (!notification?.refId) return;
    setNavigating(true);
    try {
      const res = await fetch(`/api/goals/${notification.refId}`);
      const data = await res.json();
      if (data.goal?.section) {
        onPanelClose?.();
        onClose();
        const dest = `/dashboard/${data.goal.section.toLowerCase()}?goalId=${notification.refId}`;
        requestAnimationFrame(() => router.push(dest));
      }
    } catch {
      /* silent */
    } finally {
      setNavigating(false);
    }
  }, [notification, onClose, onPanelClose, router]);

  const handleCelebrate = useCallback(() => {
    setCelebrationOpen(true);
  }, []);

  if (!notification) return null;

  const Icon = TYPE_ICON[notification.type] || Bell;
  const iconColor = TYPE_COLOR[notification.type] || "text-text-muted";
  const bgColor = TYPE_BG[notification.type] || "bg-surface-2/50";
  const label = TYPE_LABEL[notification.type] || notification.type;
  const imageSrc = TYPE_IMAGE[notification.type] || null;
  const isCelebration = CELEBRATION_TYPES.has(notification.type);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Notification" maxWidth="max-w-lg">
        <div className="space-y-5">
          {/* Header: image + type badge */}
          <div className="flex items-start gap-4">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt="Catarina"
                width={80}
                height={80}
                className="w-16 sm:w-20 h-auto rounded-xl drop-shadow-sm object-contain shrink-0"
              />
            ) : (
              <div className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${bgColor} ${iconColor} shrink-0`}>
                <Icon size={28} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${bgColor} ${iconColor} mb-2`}>
                {label}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-text break-words">
                {notification.title}
              </h3>
            </div>
          </div>

          {/* Full message or changelog */}
          {notification.type === "VERSION_UPDATE" && notification.refId ? (
            <div className="space-y-2">
              {(changelog as Record<string, { title: string; entries: { icon: string; text: string }[] }>)[notification.refId]?.entries.map((entry, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <span className="text-base shrink-0 mt-px">{entry.icon}</span>
                  <span className="leading-relaxed">{entry.text}</span>
                </div>
              )) || (
                <p className="text-sm text-text-muted">{notification.message}</p>
              )}
            </div>
          ) : (
            <div className="text-sm sm:text-base text-text-muted leading-relaxed whitespace-pre-wrap break-words">
              {notification.message}
            </div>
          )}

          {/* Audio player */}
          {notification.refType === "audio" && notification.refId && (
            <div className="pt-1">
              <AudioPlayer src={notification.refId} />
            </div>
          )}

          {/* Full goal data card */}
          {isGoal && (
            <div className="rounded-xl border border-border/60 bg-surface-2/30 overflow-hidden">
              {loadingGoal ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              ) : goalData ? (
                <div className="p-4 space-y-3">
                  {/* Goal name + ID */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base font-bold text-text break-words">{goalData.name}</h4>
                    {goalData.done && (
                      <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-text-muted/60 -mt-1">ID: {goalData.id}</p>

                  {/* Description */}
                  {goalData.description && (
                    <p className="text-sm text-text-muted leading-relaxed">{goalData.description}</p>
                  )}

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-muted">Progress</span>
                      <span className="font-semibold text-text">{goalData.current} / {goalData.target}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${goalData.target > 0 ? Math.min(100, (goalData.current / goalData.target) * 100) : 0}%`,
                          backgroundColor: goalData.done ? "var(--accent)" : "var(--text-muted)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                      <p className="text-text-muted/60 mb-0.5">Section</p>
                      <p className="font-semibold text-text">{goalData.section}</p>
                    </div>
                    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                      <p className="text-text-muted/60 mb-0.5">Deadline</p>
                      <p className="font-semibold text-text">
                        {new Date(goalData.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                      <p className="text-text-muted/60 mb-0.5">Comments</p>
                      <p className="font-semibold text-text">{goalData.comments.length}</p>
                    </div>
                    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                      <p className="text-text-muted/60 mb-0.5">Steps</p>
                      <p className="font-semibold text-text">{goalData.steps.filter((s) => s.done).length} / {goalData.steps.length}</p>
                    </div>
                  </div>

                  {/* Steps list */}
                  {goalData.steps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted mb-1.5">Steps</p>
                      <div className="space-y-1">
                        {goalData.steps.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-xs">
                            <span className={`shrink-0 h-3.5 w-3.5 rounded border flex items-center justify-center ${s.done ? "bg-accent border-accent text-bg" : "border-text-muted/30"}`}>
                              {s.done && <span className="text-[8px] font-bold">✓</span>}
                            </span>
                            <span className={s.done ? "text-text-muted line-through" : "text-text"}>{s.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignees */}
                  {goalData.assignments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted mb-1.5">Assigned to</p>
                      <div className="flex flex-wrap gap-2">
                        {goalData.assignments.map((a) => (
                          <div key={a.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-2/60 text-xs">
                            <div className="h-4 w-4 rounded-full overflow-hidden border border-border shrink-0">
                              {a.pfp ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.pfp} alt={a.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-surface-2 flex items-center justify-center text-[7px] font-bold text-text-muted">
                                  {a.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="text-text">{a.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-muted text-center py-4">Could not load goal data</p>
              )}
            </div>
          )}

          {/* Type-specific actions */}
          {isGoal && (
            <Button
              onClick={handleNavigateToGoal}
              disabled={navigating}
              className="w-full"
            >
              {navigating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Loading...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Target size={16} />
                  View Goal
                  <ArrowRight size={14} />
                </span>
              )}
            </Button>
          )}

          {isCelebration && (
            <Button onClick={handleCelebrate} className="w-full">
              <span className="inline-flex items-center gap-2">
                🎉 Celebrate
              </span>
            </Button>
          )}

          {/* Timestamp */}
          <div className="pt-2 border-t border-border/40">
            <p className="text-xs text-text-muted/70" title={fullDate(notification.createdAt)}>
              {timeAgo(notification.createdAt)}
            </p>
          </div>
        </div>
      </Modal>

      {/* Celebration modal for MONTH_CREATED / GOALS_CARRIED_OVER */}
      {isCelebration && (
        <MonthCelebrationModal
          isOpen={celebrationOpen}
          onClose={() => setCelebrationOpen(false)}
          monthName={notification.title}
        />
      )}
    </>
  );
}
