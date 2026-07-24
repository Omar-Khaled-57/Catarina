"use client";

/**
 * Admin Page — Full user management with granular permissions.
 * Features: create, edit, delete users; assign sections; edit permissions; PFP upload.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import MonthSelector from "@/components/MonthSelector";
import SectionManager from "@/components/SectionManager";
import {
  type MemberPermissions,
  DEFAULT_PERMISSIONS,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { toast } from "sonner";
import { User, Pencil, Trash2, Plus, Shield, ShieldOff, Upload, Check, UserCheck, UserX } from "lucide-react";

/** Section data from the API */
interface SectionData {
  key: string;
  label: string;
  prefix: string;
  color: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  pfp: string | null;
  bio: string | null;
  sections: string[];
  permissions: MemberPermissions;
  createdAt: string;
  _count: { goals: number; comments: number };
}

export default function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monthId, setMonthId] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [approvals, setApprovals] = useState<{ id: string; name: string; email: string; section: string; createdAt: string }[]>([]);

  /* Fetch sections */
  useEffect(() => {
    fetch("/api/sections")
      .then((res) => res.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => {});
  }, []);

  /* Auto-select latest month on load */
  useEffect(() => {
    fetch("/api/months")
      .then((res) => res.json())
      .then((data) => {
        const months = data.months || [];
        if (months.length > 0 && !monthId) {
          setMonthId(months[months.length - 1].id);
        }
      })
      .catch(() => {});
  }, []);

  /* Section lookup helpers */
  const getSectionColor = (key: string) => sections.find((s) => s.key === key)?.color || "var(--accent)";
  const getSectionLabel = (key: string) => sections.find((s) => s.key === key)?.label || key;

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push("/dashboard");
  }, [isAdmin, authLoading, router]);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [isAdmin]);

  const fetchApprovals = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/admin/approvals");
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchApprovals(); }, [isAdmin]);

  const handleApproval = async (id: string, action: "approve" | "reject") => {
    const res = await fetch("/api/admin/approvals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      toast.success(action === "approve" ? "User approved" : "Request rejected");
      fetchApprovals();
      if (action === "approve") fetchUsers();
    } else {
      toast.error("Failed to process request");
    }
  };

  const toggleRole = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}/promote`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Role changed to ${data.user.role}`);
      fetchUsers();
    } else {
      toast.error("Failed to change role");
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setDeleteUser(null);
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete user");
    }
  };

  if (authLoading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-text tracking-tight">Admin Panel</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage users, roles, permissions, and sections</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} strokeWidth={2.5} />
          New User
        </Button>
      </div>

      <MonthSelector
        currentMonthId={monthId}
        onSelectMonth={(id) => setMonthId(id)}
      />

      {/* ── Pending Approvals ───────────────────────────────────────────── */}
      {approvals.length > 0 && (
      <div className="glass rounded-2xl overflow-visible">
          <div className="h-1 w-full bg-warning opacity-60" />
          <div className="p-4">
            <h2 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              Pending Approvals ({approvals.length})
            </h2>
            <div className="space-y-2">
              {approvals.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50 border border-border/30">
                  <div className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                    <User size={16} className="text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{a.name}</p>
                    <p className="text-xs text-text-muted truncate">{a.email}</p>
                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-1"
                      style={{ backgroundColor: `${getSectionColor(a.section)}15`, color: getSectionColor(a.section) }}>
                      {getSectionLabel(a.section)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApproval(a.id, "approve")}
                      className="p-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                      title="Approve"
                    >
                      <UserCheck size={14} />
                    </button>
                    <button
                      onClick={() => handleApproval(a.id, "reject")}
                      className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                      title="Reject"
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <Card key={u.id}>
              <div className="flex items-start gap-3 mb-3">
                <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border shrink-0">
                  {u.pfp ? (
                    <img src={u.pfp} alt={u.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-2">
                      <User size={20} className="text-text-muted" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-text truncate">{u.name}</h3>
                  <p className="text-xs text-text-muted truncate">{u.email}</p>
                  {u.bio && <p className="text-xs text-text-muted mt-0.5 truncate italic">{u.bio}</p>}
                </div>
              </div>

              {/* Sections */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {u.sections.map((s) => {
                  const c = getSectionColor(s);
                  return (
                    <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${c}15`, color: c, border: `1px solid ${c}30` }}>
                      {getSectionLabel(s)}
                    </span>
                  );
                })}
                {u.sections.length === 0 && <span className="text-[10px] text-text-muted italic">No sections</span>}
              </div>

              {/* Permissions (member only) */}
              {u.role === "MEMBER" && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(u.permissions).map(([key, val]) => (
                    <span
                      key={key}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        val ? "bg-accent/10 text-accent" : "bg-surface-2 text-text-muted/50 line-through"
                      }`}
                    >
                      {PERMISSION_LABELS[key as keyof MemberPermissions]}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
                <span>Role: <span className="font-semibold text-text">{u.role}</span></span>
                <span>Goals: {u._count.goals}</span>
                <span>Comments: {u._count.comments}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditUser(u)} className="text-xs flex-1">
                  <Pencil size={12} /> Edit
                </Button>
                <Button variant="outline" onClick={() => toggleRole(u.id)} className="text-xs"
                  title={u.role === "ADMIN" ? "Demote" : "Promote"}>
                  {u.role === "ADMIN" ? <ShieldOff size={12} /> : <Shield size={12} />}
                </Button>
                <Button variant="outline" onClick={() => setDeleteUser(u)}
                  className="text-xs text-danger hover:bg-danger/10 hover:text-danger">
                  <Trash2 size={12} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); fetchUsers(); }} sections={sections} />
      )}
      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); fetchUsers(); }} sections={sections} />
      )}
      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
        <p className="text-sm text-text-muted mb-4">
          Are you sure you want to delete <strong className="text-text">{deleteUser?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
          <Button onClick={handleDelete} className="bg-danger hover:bg-danger/90 text-white">Delete</Button>
        </div>
      </Modal>

      {/* ── Section Manager ────────────────────────────────────────────── */}
      <div className="glass rounded-2xl overflow-visible transition-all duration-300 ease-out">
        <div className="p-4">
          <SectionManager />
        </div>
      </div>
    </div>
  );
}

/* ─── File Upload Hook ───────────────────────────────────────────────────── */
function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
        return null;
      }
      const data = await res.json();
      return data.url;
    } catch {
      toast.error("Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}

/* ─── PFP Upload Button ──────────────────────────────────────────────────── */
function PfpUpload({
  currentPfp,
  onUpload,
  uploading,
}: {
  currentPfp: string | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-border shrink-0">
        {currentPfp ? (
          <img src={currentPfp} alt="PFP" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <User size={24} className="text-text-muted" />
          </div>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          isLoading={uploading}
          className="text-xs"
        >
          <Upload size={12} /> Upload Photo
        </Button>
        <p className="text-[10px] text-text-muted mt-1">JPG, PNG, GIF, WebP (max 5 MB)</p>
      </div>
    </div>
  );
}

/* ─── Edit User Modal ────────────────────────────────────────────────────── */
function EditUserModal({ user, onClose, onSaved, sections }: { user: UserData; onClose: () => void; onSaved: () => void; sections: SectionData[] }) {
  const { upload, uploading } = useFileUpload();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [bio, setBio] = useState(user.bio || "");
  const [pfp, setPfp] = useState(user.pfp || "");
  const [userSections, setUserSections] = useState<string[]>(user.sections);
  const [permissions, setPermissions] = useState<MemberPermissions>(user.permissions);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (s: string) => setUserSections((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  const togglePerm = (key: keyof MemberPermissions) => setPermissions((p) => ({ ...p, [key]: !p[key] }));

  const handleUpload = async (file: File) => {
    const url = await upload(file);
    if (url) setPfp(url);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, bio, pfp, permissions }),
      });
      if (!res.ok) { toast.error("Failed to update user"); return; }

      const secRes = await fetch(`/api/admin/users/${user.id}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: userSections }),
      });
      if (!secRes.ok) { toast.error("Failed to update sections"); return; }

      toast.success("User updated");
      onSaved();
    } catch { toast.error("Something went wrong"); } finally { setIsSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${user.name}`}>
      <div className="space-y-4">
        {/* PFP Upload */}
        <PfpUpload currentPfp={pfp} onUpload={handleUpload} uploading={uploading} />

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all resize-none"
            placeholder="Short bio..." />
        </div>

        {/* Sections */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Sections</label>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const c = s.color;
              const on = userSections.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleSection(s.key)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all"
                  style={{ backgroundColor: on ? `${c}20` : "transparent", color: on ? c : "var(--text-muted)", borderColor: on ? `${c}50` : "var(--border)" }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permissions */}
        {user.role === "MEMBER" && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Permissions</label>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Create User Modal ──────────────────────────────────────────────────── */
function CreateUserModal({ onClose, onSaved, sections }: { onClose: () => void; onSaved: () => void; sections: SectionData[] }) {
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

  const toggleSection = (s: string) => setSelectedSections((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  const togglePerm = (key: keyof MemberPermissions) => setPermissions((p) => ({ ...p, [key]: !p[key] }));

  const handleUpload = async (file: File) => {
    const url = await upload(file);
    if (url) setPfp(url);
  };

  const handleCreate = async () => {
    if (!name || !email || !password) { toast.error("Name, email, and password required"); return; }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, sections: selectedSections, pfp, bio, permissions }),
      });
      if (res.ok) { toast.success("User created"); onSaved(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Something went wrong"); } finally { setIsSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Create User">
      <div className="space-y-4">
        <PfpUpload currentPfp={pfp} onUpload={handleUpload} uploading={uploading} />

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@devora.com"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="Min 6 characters"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Short bio..."
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all resize-none" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Role</label>
          <div className="flex gap-2">
            {["MEMBER", "ADMIN"].map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all ${
                  role === r ? "bg-accent/15 text-accent border-accent/40" : "text-text-muted border-border/60 hover:border-accent/30"
                }`}>{r}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Sections</label>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const c = s.color; const on = selectedSections.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleSection(s.key)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all"
                  style={{ backgroundColor: on ? `${c}20` : "transparent", color: on ? c : "var(--text-muted)", borderColor: on ? `${c}50` : "var(--border)" }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {role === "MEMBER" && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Permissions</label>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} isLoading={isSaving}>Create User</Button>
        </div>
      </div>
    </Modal>
  );
}
