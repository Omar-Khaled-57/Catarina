"use client";

/**
 * NotificationPanel — Modal with notification list, unread badge, mark read, pin, delete.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "@/components/ui/Modal";
import MonthCelebrationModal from "@/components/MonthCelebrationModal";
import Image from "next/image";
import {
  Bell,
  Check,
  Trash2,
  Pin,
  PinOff,
  CheckCheck,
  Target,
  UserPlus,
  Clock,
  AlertTriangle,
  Award,
  FileText,
  Info,
  Play,
  Pause,
  Trophy,
  MessageCircle,
  UserMinus,
  UserX,
  CalendarPlus,
  ArrowRightLeft,
  Shield,
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

/**
 * Which notification types show an image instead of a lucide icon.
 * bye.webp is half-body portrait → rendered larger.
 * cry.webp and excited.webp are head-only → standard emoji size.
 * MONTH_CREATED / GOALS_CARRIED_OVER → trigger the big celebration modal (no inline image).
 */
const TYPE_IMAGE: Record<string, string> = {
  GOAL_CREATED:         "/rina/edit.webp",
  STEP_ADDED:           "/rina/edit.webp",
  DEADLINE_APPROACHING: "/rina/dealine.webp",
  DEADLINE_MISSED:     "/rina/deadline.webp",
  SYSTEM:               "/rina/thumb.webp",
  COMMENT_ADDED:        "/rina/note.webp",
  ROLE_CHANGED:         "/rina/role-changed.webp",
  GOAL_REACHED:         "/rina/excited.webp",
  GOAL_COMPLETED:       "/rina/excited.webp",
  MEMBER_JOINED:        "/rina/excited.webp",
  SIGNUP_REQUEST:       "/rina/thumb.webp",
  SIGNUP_REJECTED:      "/rina/cry.webp",
  MEMBER_LEFT_SECTION:  "/rina/cry.webp",
  MEMBER_DELETED:       "/rina/bye.webp",
  VERSION_UPDATE:       "/rina/update.webp",
};

/** Types that skip the inline image and instead open the big celebration modal */
const CELEBRATION_TYPES = new Set(["MONTH_CREATED", "GOALS_CARRIED_OVER"]);

/**
 * Image sizes per image file — tuned to actual content/aspect ratio.
 * bye.webp   — half-body portrait (~600×670px source) → display larger
 * excited / cry / happy / thumb / sleeping → head-only sticker, roughly square
 */
const IMAGE_SIZES: Record<string, { width: number; height: number; className: string }> = {
  "/rina/bye.webp":     { width: 128, height: 156,  className: "w-[72px] sm:w-[128px] min-w-[72px] sm:min-w-[128px] h-auto rounded-xl object-contain drop-shadow-sm" },
  "/rina/excited.webp": { width: 100, height: 100,  className: "w-16 sm:w-[100px] min-w-[64px] sm:min-w-[100px] h-16 sm:h-[100px] rounded-xl drop-shadow-sm object-contain" },
  "/rina/cry.webp":     { width: 100, height: 100,  className: "w-16 sm:w-[100px] min-w-[64px] sm:min-w-[100px] h-16 sm:h-[100px] rounded-xl drop-shadow-sm object-contain" },
  "/rina/thumb.webp":   { width: 100, height: 100,  className: "w-16 sm:w-[100px] min-w-[64px] sm:min-w-[100px] h-16 sm:h-[100px] rounded-xl drop-shadow-sm object-contain" },
  "/rina/happy.webp":   { width: 100, height: 100,  className: "w-16 sm:w-[100px] min-w-[64px] sm:min-w-[100px] h-16 sm:h-[100px] rounded-xl drop-shadow-sm object-contain" },
  "/rina/update.webp":  { width: 100, height: 100,  className: "w-16 sm:w-[100px] min-w-[64px] sm:min-w-[100px] h-16 sm:h-[100px] rounded-xl drop-shadow-sm object-contain" },
};

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

export function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setError(false);
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setError(true);
      }
    }
  };

  return (
    <span className="inline-flex flex-col gap-0.5 mt-2">
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all"
      >
        {error ? <AlertTriangle size={14} /> : playing ? <Pause size={14} /> : <Play size={14} />}
        {error ? "Error" : playing ? "Pause" : "Play"}
      </button>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        preload="none"
        className="hidden"
      />
    </span>
  );
}

export default function NotificationPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationMonth, setCelebrationMonth] = useState<string | undefined>();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch notifications on panel open
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
  };

  const togglePin = async (id: string, pinned: boolean) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n))
    );
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned: !pinned }),
    });
  };

  const deleteNotification = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (notif && !notif.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const clearRead = async () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearRead: true }),
    });
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Notifications" maxWidth="max-w-xl sm:max-w-2xl">
      {/* Actions bar */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-accent hover:text-accent-2 transition-colors"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
          {notifications.some((n) => n.read) && (
            <button
              onClick={clearRead}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-text-muted hover:text-danger transition-colors ms-auto"
            >
              <Trash2 size={14} />
              Clear read
            </button>
          )}
        </div>
      )}

      {/* Notification list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Image src="/rina/sleeping.webp" alt="Catarina sleeping" width={160} height={160} className="w-32 sm:w-40 h-auto mx-auto mb-4 drop-shadow-sm rounded-2xl" />
          <p className="text-base sm:text-lg font-semibold">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] || Bell;
            const iconColor = TYPE_COLOR[n.type] || "text-text-muted";
            const isWelcome = n.title === "Why Catarina? 🌸";
            const isCelebration = CELEBRATION_TYPES.has(n.type);
            const imageSrc = isCelebration ? null : (isWelcome ? "/rina/happy.webp" : (TYPE_IMAGE[n.type] || null));
            const imgSize = imageSrc ? (IMAGE_SIZES[imageSrc] ?? { width: 48, height: 48, className: "rounded-xl" }) : null;
            return (
              <div
                key={n.id}
                onClick={isCelebration ? () => {
                  setCelebrationMonth(n.title);
                  setCelebrationOpen(true);
                  if (!n.read) markRead(n.id);
                } : undefined}
                className={`flex items-start gap-2.5 sm:gap-4 p-2.5 sm:p-3.5 rounded-xl transition-colors group/n ${
                  n.read ? "opacity-60" : "bg-surface-2/40"
                } ${isWelcome ? "ring-1 ring-accent/20 bg-accent/5" : ""} ${
                  isCelebration ? "cursor-pointer hover:bg-surface-2/60 ring-1 ring-amber-500/20" : ""
                }`}
              >
                <div className={`shrink-0 ${
                  imageSrc
                    ? (imageSrc === "/rina/bye.webp" ? "mt-0" : "mt-0.5")
                    : "mt-0.5"
                } ${!imageSrc && !isCelebration ? iconColor : ""}`}>
                  {isCelebration ? (
                    /* Celebration types show a sparkle emoji badge instead of an image inline */
                    <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 text-2xl select-none">
                      🎉
                    </span>
                  ) : imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt="Catarina"
                      width={imgSize!.width}
                      height={imgSize!.height}
                      className={imgSize!.className}
                    />
                  ) : (
                    <Icon size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <p className={`min-w-0 break-words text-sm sm:text-base font-bold ${n.read ? "text-text-muted" : "text-text"}`}>
                      {n.title}
                    </p>
                    {n.pinned && <Pin size={14} className="text-accent shrink-0" />}
                  </div>
                  <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed line-clamp-3 break-words">
                    {n.message}
                  </p>
                  {n.refType === "audio" && n.refId && (
                    <AudioPlayer src={n.refId} />
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-text-muted/70">{timeAgo(n.createdAt)}</p>
                    <div className="flex items-center gap-1 sm:hidden">
                      {!n.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-accent transition-colors"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <Check size={15} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(n.id, n.pinned);
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-accent transition-colors"
                        title={n.pinned ? "Unpin" : "Pin"}
                        aria-label={n.pinned ? "Unpin" : "Pin"}
                      >
                        {n.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger transition-colors"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover/n:opacity-100 transition-opacity shrink-0">
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(n.id);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent transition-colors"
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(n.id, n.pinned);
                    }}
                    className="p-1.5 rounded-lg text-text-muted hover:text-accent transition-colors"
                    title={n.pinned ? "Unpin" : "Pin"}
                  >
                    {n.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>

    {/* Month Celebration Modal — big centered popup with confetti */}
    <MonthCelebrationModal
      isOpen={celebrationOpen}
      onClose={() => setCelebrationOpen(false)}
      monthName={celebrationMonth}
    />
    </>
  );
}
