"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import PfpUpload from "@/components/PfpUpload";
import useFileUpload from "@/hooks/useFileUpload";
import {
  type MemberPermissions,
  DEFAULT_PERMISSIONS,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { type SectionDataFull } from "@/types";
import { toast } from "sonner";

export default function CreateUserModal({
  onClose,
  onSaved,
  sections,
}: {
  onClose: () => void;
  onSaved: () => void;
  sections: SectionDataFull[];
}) {
  const { upload, uploading } = useFileUpload();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [pfp, setPfp] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<MemberPermissions>(DEFAULT_PERMISSIONS);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (s: string) =>
    setSelectedSections((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const togglePerm = (key: keyof MemberPermissions) =>
    setPermissions((p) => ({ ...p, [key]: !p[key] }));

  const handleUpload = async (file: File) => {
    const url = await upload(file);
    if (url) setPfp(url);
  };

  const handleCreate = async () => {
    if (!name || !email || !password) {
      toast.error("Name, email, and password required");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, sections: selectedSections, pfp, bio, permissions }),
      });
      if (res.ok) {
        toast.success("User created");
        onSaved();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Create User">
      <div className="space-y-4">
        <PfpUpload currentPfp={pfp} onUpload={handleUpload} uploading={uploading} />

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
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
            placeholder="john@devora.com"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            placeholder="Min 6 characters"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
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
            placeholder="Short bio..."
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Role
          </label>
          <div className="flex gap-2">
            {["MEMBER", "ADMIN"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all ${
                  role === r
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "text-text-muted border-border/60 hover:border-accent/30"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Sections
          </label>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const c = s.color;
              const on = selectedSections.includes(s.key);
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

        {role === "MEMBER" && (
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
          <Button onClick={handleCreate} isLoading={isSaving}>
            Create User
          </Button>
        </div>
      </div>
    </Modal>
  );
}
