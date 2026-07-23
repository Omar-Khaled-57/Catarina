"use client";

/**
 * Navbar — Top navigation bar with glassmorphism effect.
 * Shows app name, theme toggle, and user menu with PFP.
 * Clicking PFP opens a profile modal with user details.
 * Responsive: collapses to hamburger on mobile.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn, getDefaultPfp } from "@/lib/utils";
import { SECTION_COLORS, SECTION_LABELS, type Section } from "@/lib/auth";
import Modal from "@/components/ui/Modal";
import NotificationPanel from "@/components/NotificationPanel";
import { Sun, Moon, LogOut, User, Upload, Check, Bell } from "lucide-react";
import Image from "next/image";

export default function Navbar() {
  const { user, logout, isAdmin, refreshUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  /* Poll unread notification count */
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true");
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (user) {
      const timeout = window.setTimeout(fetchUnread, 0);
      const interval = setInterval(fetchUnread, 30000);
      return () => {
        window.clearTimeout(timeout);
        clearInterval(interval);
      };
    }
  }, [user, fetchUnread]);

  return (
    <>
      <nav className="glass sticky top-0 z-40 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + App Name */}
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image src="/logo.png" alt="Catarina Logo" width={36} height={36} className="h-9 w-9 rounded-xl object-contain" />
              <span className="text-lg font-bold text-text tracking-tight">
                Catarina
              </span>
            </Link>

            {/* Center: Navigation Links */}
            <div className="hidden sm:flex items-center gap-1">
              <NavLink href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </NavLink>
              <NavLink
                href="/dashboard/archive"
                active={pathname.startsWith("/dashboard/archive")}
              >
                Archive
              </NavLink>
              {isAdmin && (
                <NavLink
                  href="/dashboard/admin"
                  active={pathname.startsWith("/dashboard/admin")}
                >
                  Admin
                </NavLink>
              )}
            </div>

            {/* Right: Theme Toggle + User Menu */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Notification Bell */}
              <button
                onClick={() => setShowNotifications(true)}
                className="relative rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-bg bg-danger flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* User Info + PFP */}
              {user && (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-text leading-tight">
                      {user.name}
                    </p>
                    <p className="text-xs text-text-muted">{user.role}</p>
                  </div>

                  {/* PFP Button — opens profile modal */}
                  <button
                    onClick={() => setShowProfile(true)}
                    className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-border hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                    aria-label="View profile"
                  >
                    {user.pfp ? (
                      <Image
                        src={user.pfp}
                        alt={`${user.name} avatar`}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : getDefaultPfp(user.primarySection || user.sections[0]) ? (
                      <Image
                        src={getDefaultPfp(user.primarySection || user.sections[0])!}
                        alt={`${user.name} avatar`}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-surface-2">
                        <User size={16} className="text-text-muted" aria-hidden="true" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={logout}
                    className="rounded-lg p-2 text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                    aria-label="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Modal */}
      {user && (
        <ProfileModal
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          user={user}
          isAdmin={isAdmin}
          refreshUser={refreshUser}
        />
      )}

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          fetchUnread();
        }}
      />
    </>
  );
}

/* ─── Profile Modal ────────────────────────────────────────────────────────── */
function ProfileModal({
  isOpen,
  onClose,
  user,
  isAdmin,
  refreshUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    role: string;
    pfp: string | null;
    bio: string | null;
    sections: string[];
    primarySection: string | null;
  };
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}) {
  const [pickedSection, setPickedSection] = useState<string>(user.primarySection || "MANAGEMENT");
  const [saving, setSaving] = useState(false);
  const [pfp, setPfp] = useState(user.pfp);
  const [uploading, setUploading] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editBio, setEditBio] = useState(user.bio || "");
  const [hasChanges, setHasChanges] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const markChanged = () => setHasChanges(true);

  const handlePickSection = async (section: string) => {
    setPickedSection(section);
    setSaving(true);
    try {
      await fetch("/api/auth/primary-section", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      await refreshUser();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setPfp(data.url);
        setHasChanges(true);
      }
    } catch { /* silent */ } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, bio: editBio, pfp }),
      });
      await refreshUser();
      setHasChanges(false);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My Profile">
      <div className="space-y-5">
        {/* PFP + Role header */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-border">
              {pfp ? (
                <Image src={pfp} alt={`${user.name} avatar`} fill sizes="64px" className="object-cover" />
              ) : getDefaultPfp(user.primarySection || user.sections[0]) ? (
                <Image src={getDefaultPfp(user.primarySection || user.sections[0])!} alt={`${user.name} avatar`} fill sizes="64px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-2">
                  <User size={28} className="text-text-muted" aria-hidden="true" />
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-accent flex items-center justify-center text-bg shadow-lg hover:bg-accent-2 transition-colors disabled:opacity-50"
              title="Upload photo"
            >
              <Upload size={11} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {user.role}
            </span>
            <p className="text-[11px] text-text-muted mt-1">
              {user.sections.length > 0
                ? user.sections.map((s) => SECTION_LABELS[s as Section] || s).join(", ")
                : "No teams"}
            </p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => { setEditName(e.target.value); markChanged(); }}
              className="w-full rounded-lg bg-surface-2 border border-border/60 px-3 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => { setEditEmail(e.target.value); markChanged(); }}
              className="w-full rounded-lg bg-surface-2 border border-border/60 px-3 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => { setEditBio(e.target.value); markChanged(); }}
              rows={2}
              placeholder="A short bio..."
              className="w-full rounded-lg bg-surface-2 border border-border/60 px-3 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* Sections — clickable for admins */}
        {user.sections.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Teams {isAdmin && <span className="normal-case font-normal opacity-60">— click to highlight</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {user.sections.map((s) => {
                const c = SECTION_COLORS[s as Section] || "var(--accent)";
                const isHighlighted = isAdmin && pickedSection === s;
                return (
                  <button
                    key={s}
                    onClick={() => isAdmin && handlePickSection(s)}
                    disabled={saving}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      isAdmin ? "cursor-pointer hover:scale-105" : "cursor-default"
                    }`}
                    style={{
                      backgroundColor: isHighlighted ? `${c}25` : `${c}12`,
                      color: c,
                      border: isHighlighted ? `1.5px solid ${c}` : `1px solid ${c}25`,
                    }}
                  >
                    {SECTION_LABELS[s as Section] || s}
                    {isHighlighted && " ★"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Save button */}
        {hasChanges && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-accent text-bg hover:bg-accent-2 transition-colors disabled:opacity-50"
            >
              <Check size={13} strokeWidth={3} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── NavLink Helper ──────────────────────────────────────────────────────── */
function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent/10 text-accent"
          : "text-text-muted hover:bg-surface-2 hover:text-text"
      )}
    >
      {children}
    </Link>
  );
}
