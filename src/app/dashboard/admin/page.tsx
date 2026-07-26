"use client";

/**
 * Admin Page — Full user management with granular permissions.
 * Features: create, edit, delete users; assign sections; edit permissions; PFP upload.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import MonthSelector from "@/components/MonthSelector";
import SectionManager from "@/components/SectionManager";
import EditUserModal from "@/components/admin/EditUserModal";
import CreateUserModal from "@/components/admin/CreateUserModal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import {
  type MemberPermissions,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { type SectionDataFull } from "@/types";
import { toast } from "sonner";
import { User, Pencil, Trash2, Plus, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";

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
  const [sections, setSections] = useState<SectionDataFull[]>([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to auto-select latest month
  }, []);

  /* Section lookup helpers */
  const getSectionColor = (key: string) => sections.find((s) => s.key === key)?.color || "var(--accent)";
  const getSectionLabel = (key: string) => sections.find((s) => s.key === key)?.label || key;

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push("/dashboard");
  }, [isAdmin, authLoading, router]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- fetch on admin mount */
  useEffect(() => {
    fetchUsers();
  }, [isAdmin]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const fetchApprovals = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/admin/approvals");
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch { /* silent */ }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- fetch on admin mount */
  useEffect(() => {
    fetchApprovals();
  }, [isAdmin]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* ─── Realtime Sync — refetch users/approvals when things change ──────────── */
  const { generation, snapshotRef } = useRealtimeSync({
    enabled: !!isAdmin,
  });
  const usersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (generation === 0) return;
    const { goals: deltaGoals, sectionChanged } = snapshotRef.current;

    if (deltaGoals.length > 0) {
      if (usersTimerRef.current) clearTimeout(usersTimerRef.current);
      usersTimerRef.current = setTimeout(() => fetchUsers(), 500);
    }

    if (sectionChanged) {
      fetch("/api/sections")
        .then((res) => res.json())
        .then((data) => setSections(data.sections || []));
    }
  }, [generation, snapshotRef, fetchUsers]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-text tracking-tight">Admin Panel</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage users, roles, permissions, and sections</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5 sm:gap-2 px-3 sm:px-5 py-2">
          <Plus size={16} strokeWidth={2.5} />
          <span className="text-xs sm:text-sm">New User</span>
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
                    // eslint-disable-next-line @next/next/no-img-element
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
