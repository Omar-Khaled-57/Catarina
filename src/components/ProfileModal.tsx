"use client";

/**
 * ProfileModal — Edit profile, password, PFP, and primary section.
 * Uses the shared Modal component with portal rendering.
 */

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import { getDefaultPfp } from "@/lib/utils";
import { User, Upload, Check } from "lucide-react";
import { toast } from "sonner";

interface ProfileModalProps {
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
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  isAdmin,
  refreshUser,
}: ProfileModalProps) {
  const [pickedSection, setPickedSection] = useState<string>(user.primarySection || "MANAGEMENT");
  const [saving, setSaving] = useState(false);
  const [pfp, setPfp] = useState(user.pfp);
  const [uploading, setUploading] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editBio, setEditBio] = useState(user.bio || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [sectionLabels, setSectionLabels] = useState<Record<string, string>>({});
  const [sectionColors, setSectionColors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  /* Fetch dynamic section labels and colors */
  useEffect(() => {
    fetch("/api/sections")
      .then((r) => r.json())
      .then((data) => {
        const labels: Record<string, string> = {};
        const colors: Record<string, string> = {};
        for (const s of data.sections || []) {
          labels[s.key] = s.label;
          colors[s.key] = s.color;
        }
        setSectionLabels(labels);
        setSectionColors(colors);
      })
      .catch(() => {});
  }, []);

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
        toast.success("Profile picture updated");
      } else {
        const data = await res.json();
        toast.error(data.error || "Upload failed, try again");
      }
    } catch {
      toast.error("Upload failed, try again");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { name: editName, email: editEmail, bio: editBio, pfp: pfp || "" };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await refreshUser();
        setHasChanges(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Profile saved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save, try again");
      }
    } catch {
      toast.error("Failed to save, try again");
    } finally {
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
              aria-label="Upload profile photo"
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
                ? user.sections.map((s) => sectionLabels[s] || s).join(", ")
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

          {/* Password Change (collapsible) */}
          <details className="group">
            <summary className="text-[10px] font-semibold uppercase tracking-wider text-text-muted cursor-pointer select-none hover:text-text transition-colors">
              Change Password
            </summary>
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); if (newPassword) markChanged(); }}
                  placeholder="Enter current password"
                  className="w-full rounded-lg bg-surface-2 border border-border/60 px-3 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); markChanged(); }}
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg bg-surface-2 border border-border/60 px-3 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); markChanged(); }}
                  placeholder="Repeat new password"
                  className="w-full rounded-lg bg-surface-2 border border-border/60 px-3 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[10px] text-danger font-medium">Passwords do not match</p>
              )}
            </div>
          </details>
        </div>

        {/* Sections — clickable for admins */}
        {user.sections.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Teams {isAdmin && <span className="normal-case font-normal opacity-60">— click to highlight</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {user.sections.map((s) => {
                const c = sectionColors[s] || "#00E8A2";
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
                    {sectionLabels[s] || s}
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
