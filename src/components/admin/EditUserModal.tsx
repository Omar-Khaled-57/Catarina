"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import PfpUpload from "@/components/PfpUpload";
import useFileUpload from "@/lib/useFileUpload";
import {
  type MemberPermissions,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { type SectionDataFull } from "@/types";
import { toast } from "sonner";

interface EditUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  sections: string[];
  permissions: MemberPermissions;
}

export default function EditUserModal({
  user,
  onClose,
  onSaved,
  sections,
}: {
  user: EditUserData;
  onClose: () => void;
  onSaved: () => void;
  sections: SectionDataFull[];
}) {
  const { upload, uploading } = useFileUpload();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [bio, setBio] = useState(user.bio || "");
  const [pfp, setPfp] = useState(user.pfp || "");
  const [userSections, setUserSections] = useState<string[]>(user.sections);
  const [permissions, setPermissions] = useState<MemberPermissions>(user.permissions);
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (s: string) =>
    setUserSections((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const togglePerm = (key: keyof MemberPermissions) =>
    setPermissions((p) => ({ ...p, [key]: !p[key] }));

  const handleUpload = async (file: File) => {
    const url = await upload(file);
    if (url) setPfp(url);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { name, email, bio, pfp, permissions };
      if (newPassword && newPassword.length >= 6) {
        body.newPassword = newPassword;
      }
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Failed to update user");
        return;
      }

      const secRes = await fetch(`/api/admin/users/${user.id}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: userSections }),
      });
      if (!secRes.ok) {
        toast.error("Failed to update sections");
        return;
      }

      toast.success("User updated");
      onSaved();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${user.name}`}>
      <div className="space-y-4">
        <PfpUpload currentPfp={pfp} onUpload={handleUpload} uploading={uploading} />

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all resize-none"
            placeholder="Short bio..."
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Reset Password{" "}
            <span className="normal-case font-normal opacity-60">(leave blank to keep current)</span>
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            placeholder="New password (min 6 chars)"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        {/* Sections */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Sections
          </label>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const c = s.color;
              const on = userSections.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSection(s.key)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all"
                  style={{
                    backgroundColor: on ? `${c}20` : "transparent",
                    color: on ? c : "var(--text-muted)",
                    borderColor: on ? `${c}50` : "var(--border)",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permissions */}
        {user.role === "MEMBER" && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Permissions
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PERMISSION_LABELS) as (keyof MemberPermissions)[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePerm(key)}
                  className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border transition-all ${
                    permissions[key] ? "bg-accent/5 border-accent/30" : "border-border/60"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
                      permissions[key]
                        ? "border-transparent bg-accent"
                        : "border-text-muted/30"
                    }`}
                  >
                    {permissions[key] && <Check size={10} strokeWidth={3} className="text-bg" />}
                  </div>
                  <span className={permissions[key] ? "text-accent font-semibold" : "text-text-muted"}>
                    {PERMISSION_LABELS[key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
