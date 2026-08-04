"use client";

/**
 * Navbar — Top navigation bar with glassmorphism effect.
 * Shows app name, theme toggle, and user menu with PFP.
 * Responsive: hamburger menu on mobile with framer-motion animation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn, getDefaultPfp } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import NotificationPanel from "@/components/NotificationPanel";
import ProfileModal from "@/components/ProfileModal";
import { Sun, Moon, LogOut, User, Bell, Target } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { consumeSuppress } from "@/lib/toastSuppress";

export default function Navbar() {
  const { user, logout, isAdmin, refreshUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  /* Poll unread notification count with smart intervals */
  const lastCountRef = useRef(0);
  const lastToastRef = useRef(0);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      const count = data.unreadCount || 0;

      /* Toast when new notifications arrive from other users (skip own actions) */
      if (count > lastCountRef.current && lastCountRef.current > 0 && !consumeSuppress()) {
        const now = Date.now();
        if (now - lastToastRef.current > 10000) {
          lastToastRef.current = now;
          const diff = count - lastCountRef.current;
          toast(`Activity on your goals${diff > 1 ? " — " + diff + " new updates" : ""}`, {
            icon: <Target size={16} />,
            duration: 4000,
          });
        }
      }

      lastCountRef.current = count;
      setUnreadCount(count);
    } catch { /* silent */ }
  }, []);

  usePolling(fetchUnread, 15000, !!user);

  /* Close mobile menu on route change */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close mobile menu on route change
    setIsMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/archive", label: "Archive" },
    ...(isAdmin ? [{ href: "/dashboard/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      <nav className="glass sticky top-0 z-40 border-b border-border px-4 py-3 sm:px-6 lg:px-8 relative">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Left: Logo + App Name */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <Image
              src="/icons/logo.webp"
              alt="Catarina Logo"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 min-w-10 sm:min-w-12 rounded-xl object-contain transition-transform group-hover:scale-105"
            />
            <span className="text-lg font-bold text-text tracking-tight">
              Catarina
            </span>
          </Link>

          {/* Center: Navigation Links (Desktop) */}
          <div className="hidden flex-1 justify-center gap-1.5 md:flex">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-semibold rounded-xl transition-colors duration-200",
                    isActive
                      ? "text-accent"
                      : "text-text-muted hover:text-text hover:bg-surface-2/60"
                  )}
                >
                  <span className="relative z-10">{link.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="activeTabPill"
                      className="absolute inset-0 rounded-xl bg-accent/15 border border-accent/20 shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Bell (desktop only — mobile has it in menu) */}
            <button
              onClick={() => setShowNotifications(true)}
              className="relative hidden rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors md:block"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-bg bg-danger flex items-center justify-center" aria-live="polite">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* User Info + PFP (desktop) */}
            {user && (
              <div className="hidden items-center gap-3 md:flex">
                <div className="text-right">
                  <p className="text-sm font-semibold text-text leading-tight">
                    {user.name}
                  </p>
                  <p className="text-xs text-text-muted">{user.role}</p>
                </div>
                <button
                  onClick={() => setShowProfile(true)}
                  className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-border hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                  aria-label="View profile"
                >
                  {user.pfp ? (
                    <Image src={user.pfp} alt={`${user.name} avatar`} fill sizes="36px" className="object-cover" />
                  ) : getDefaultPfp(user.primarySection || user.sections[0]) ? (
                    <Image src={getDefaultPfp(user.primarySection || user.sections[0])!} alt={`${user.name} avatar`} fill sizes="36px" className="object-cover" />
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

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden rounded-lg p-2 text-text hover:bg-surface-2 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              id="mobile-menu"
              key="mobile-menu"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden origin-top"
              style={{ transformOrigin: "top center", willChange: "transform, opacity" }}
            >
              <div className="mt-3 pt-3 border-t border-border flex flex-col gap-3 pb-2">
                {/* User Info (mobile) */}
                {user && (
                  <div className="flex items-center gap-3 px-1 pb-2">
                    <button
                      onClick={() => { setShowProfile(true); setIsMenuOpen(false); }}
                      className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-border shrink-0"
                    >
                      {user.pfp ? (
                        <Image src={user.pfp} alt={`${user.name} avatar`} fill sizes="40px" className="object-cover" />
                      ) : getDefaultPfp(user.primarySection || user.sections[0]) ? (
                        <Image src={getDefaultPfp(user.primarySection || user.sections[0])!} alt={`${user.name} avatar`} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-surface-2">
                          <User size={18} className="text-text-muted" />
                        </div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{user.name}</p>
                      <p className="text-xs text-text-muted">{user.role}</p>
                    </div>
                  </div>
                )}

                {/* Nav Links */}
                <div className="flex flex-col gap-1">
                  {navLinks.map((link, i) => {
                    const isActive =
                      link.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(link.href);
                    return (
                      <div
                        key={link.href}
                        className="animate-mobile-menu-item"
                        style={{ animationDelay: `${60 + i * 55}ms` }}
                      >
                        <Link
                          href={link.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={cn(
                            "flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors",
                            isActive
                              ? "bg-accent/10 text-accent"
                              : "text-text-muted hover:text-text hover:bg-surface-2"
                          )}
                        >
                          {isActive && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-accent" />}
                          {link.label}
                        </Link>
                      </div>
                    );
                  })}
                </div>

                <div className="h-px w-full bg-border" />

                {/* Notifications (mobile) */}
                <div className="animate-mobile-menu-item" style={{ animationDelay: `${60 + navLinks.length * 55}ms` }}>
                  <button
                    onClick={() => { setShowNotifications(true); setIsMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                  >
                    <Bell size={16} />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold text-bg bg-danger flex items-center justify-center" aria-live="polite">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {user && (
                <div className="animate-mobile-menu-item" style={{ animationDelay: `${115 + navLinks.length * 55}ms` }}>
                  <button
                    onClick={() => { setShowProfile(true); setIsMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                  >
                    <User size={16} />
                    My Profile
                  </button>
                </div>
                )}

                {user && (
                <div className="animate-mobile-menu-item" style={{ animationDelay: `${170 + navLinks.length * 55}ms` }}>
                  <button
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
