"use client";

/**
 * GoalForm — Create/Edit goal modal with assignments picker.
 */

import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronUp, Loader2, Search, UserPlus } from "lucide-react";

export interface GoalAssignmentData {
  userId: string;
  canCheck: boolean;
  canEdit: boolean;
}

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    current: number;
    target: number;
    deadline: string;
    monthId: string;
  }) => Promise<string | null> | string | null;
  onSaveAssignments: (goalId: string, assignments: GoalAssignmentData[]) => Promise<void> | void;
  initialData: {
    id?: string;
    name?: string;
    description?: string;
    current?: number;
    target?: number;
    deadline?: string;
    monthId?: string;
    assignments?: GoalAssignmentData[];
  } | null;
  isAdmin: boolean;
  section: string;
  goalId?: string;
}

interface UserOption {
  id: string;
  name: string;
  pfp: string | null;
  sections: string[];
}

const SECTION_PREFIX: Record<string, string> = {
  MANAGEMENT: "MNG",
  ART: "ART",
  MARKETING: "MRK",
  TECHNICAL: "TEC",
};

export default function GoalForm({
  isOpen,
  onClose,
  onSave,
  onSaveAssignments,
  initialData,
  isAdmin,
  section,
  goalId,
}: GoalFormProps) {
  useAuth();
  const prefix = SECTION_PREFIX[section] || section.slice(0, 3).toUpperCase();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState(1);
  const [deadline, setDeadline] = useState("");
  const [monthId, setMonthId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const [months, setMonths] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [assignments, setAssignments] = useState<GoalAssignmentData[]>([]);
  const [showAssignments, setShowAssignments] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- reset form fields when modal opens */
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setCurrent(initialData.current ?? 0);
      setTarget(initialData.target ?? 1);
      setDeadline(initialData.deadline || "");
      setMonthId(initialData.monthId || "");
      setAssignments(initialData.assignments || []);
    } else {
      setName("");
      setDescription("");
      setCurrent(0);
      setTarget(1);
      setDeadline("");
      setAssignments([]);
    }
    setShowAssignments(false);
    setUserSearch("");
  }, [isOpen, initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/months")
      .then((r) => r.json())
      .then((d) => setMonths(d.months || []))
      .catch(() => {});
  }, [isOpen]);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch users when assignments panel opens */
  useEffect(() => {
    if (!isOpen || !showAssignments) return;
    setLoadingUsers(true);
    fetch(`/api/users?section=${encodeURIComponent(section)}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [isOpen, showAssignments, section]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, userSearch]);

  const toggleAssignment = (userId: string) => {
    setAssignments((prev) => {
      const exists = prev.find((a) => a.userId === userId);
      if (exists) return prev.filter((a) => a.userId !== userId);
      return [...prev, { userId, canCheck: true, canEdit: false }];
    });
  };

  const updateAssignment = (userId: string, field: "canCheck" | "canEdit", value: boolean) => {
    setAssignments((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, [field]: value } : a))
    );
  };

  const isAssigned = (userId: string) => assignments.some((a) => a.userId === userId);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Goal name is required");
      return;
    }
    if (!monthId) {
      toast.error("Please select a month");
      return;
    }
    if (current > target) {
      toast.error("Current progress cannot exceed target");
      return;
    }

    setIsSaving(true);
    try {
      const newGoalId = await onSave({
        name: name.trim(),
        description: description.trim(),
        current,
        target,
        deadline,
        monthId,
      });

      if (assignments.length > 0 && (goalId || newGoalId)) {
        setSavingAssignments(true);
        try {
          await onSaveAssignments(goalId || newGoalId!, assignments);
        } finally {
          setSavingAssignments(false);
        }
      }

      onClose();
    } catch {
      toast.error("Failed to save goal");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Goal" : "New Goal"} maxWidth="max-w-lg">
      <form id="goal-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="goal-name" className="block text-xs font-semibold text-text-muted mb-1">
            Goal Name
          </label>
          <input
            id="goal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Redesign landing page"
            className="w-full text-sm rounded-xl bg-surface-2 border border-border px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
            required
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="goal-description" className="block text-xs font-semibold text-text-muted mb-1">
            Description
          </label>
          <textarea
            id="goal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context, acceptance criteria, or links..."
            rows={3}
            className="w-full text-sm rounded-xl bg-surface-2 border border-border px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-none"
            maxLength={1000}
          />
        </div>

        {/* Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="goal-current" className="block text-xs font-semibold text-text-muted mb-1">
              Current
            </label>
            <input
              id="goal-current"
              type="number"
              min={0}
              value={current}
              onChange={(e) => setCurrent(Math.max(0, parseInt(e.target.value || "0")))}
              className="w-full text-sm text-center rounded-xl bg-surface-2 border border-border px-3 py-2 text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="goal-target" className="block text-xs font-semibold text-text-muted mb-1">
              Target
            </label>
            <input
              id="goal-target"
              type="number"
              min={1}
              value={target}
              onChange={(e) => {
                const v = parseInt(e.target.value || "1");
                setTarget(Math.max(1, v));
                if (current > v) setCurrent(v);
              }}
              className="w-full text-sm text-center rounded-xl bg-surface-2 border border-border px-3 py-2 text-text focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Deadline + Month */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="goal-deadline" className="block text-xs font-semibold text-text-muted mb-1">
              Deadline
            </label>
            <input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={today}
              className="w-full text-sm rounded-xl bg-surface-2 border border-border px-3 py-2 text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="goal-month" className="block text-xs font-semibold text-text-muted mb-1">
              Month
            </label>
            <select
              id="goal-month"
              value={monthId}
              onChange={(e) => setMonthId(e.target.value)}
              className="w-full text-sm rounded-xl bg-surface-2 border border-border px-3 py-2 text-text focus:outline-none focus:border-accent"
              required
            >
              <option value="">Select month</option>
              {months.map((m) => (
                <option key={m.id} value={m.id}>
                  {prefix}-{m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignments */}
        <div>
          <button
            type="button"
            onClick={() => setShowAssignments(!showAssignments)}
            className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text transition-colors mt-1"
            aria-expanded={showAssignments}
            aria-controls="goal-assignments-panel"
          >
            <UserPlus size={14} />
            Assignments
            {assignments.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent">
                {assignments.length}
              </span>
            )}
            {showAssignments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAssignments && (
            <div id="goal-assignments-panel" className="mt-2 rounded-xl border border-border bg-surface-2/50 overflow-hidden">
              <div className="p-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full text-xs rounded-lg bg-surface-2 border border-border pl-8 pr-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={16} className="animate-spin text-text-muted" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">No users found</p>
                ) : (
                  filteredUsers.map((u) => {
                    const assigned = isAssigned(u.id);
                    const assignment = assignments.find((a) => a.userId === u.id);
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                          assigned ? "bg-accent/5" : "hover:bg-surface-2"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAssignment(u.id)}
                          className={`shrink-0 flex h-4 w-4 items-center justify-center rounded-md border-2 transition-all ${
                            assigned ? "border-accent bg-accent text-bg" : "border-text-muted/40"
                          }`}
                          aria-label={`Assign ${u.name}`}
                          aria-pressed={assigned}
                        >
                          {assigned && <Check size={10} strokeWidth={3} />}
                        </button>

                        <div className="h-6 w-6 rounded-full overflow-hidden border border-border shrink-0">
                          {u.pfp ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.pfp} alt={u.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-surface-2 flex items-center justify-center text-[9px] font-bold text-text-muted">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <span className="text-xs flex-1 truncate">{u.name}</span>

                        {assigned && isAdmin && (
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer">
                              <input
                                type="checkbox"
                                checked={assignment?.canCheck ?? false}
                                onChange={(e) => updateAssignment(u.id, "canCheck", e.target.checked)}
                                className="h-3 w-3 rounded border-border accent-accent"
                              />
                              Check
                            </label>
                            <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer">
                              <input
                                type="checkbox"
                                checked={assignment?.canEdit ?? false}
                                onChange={(e) => updateAssignment(u.id, "canEdit", e.target.checked)}
                                className="h-3 w-3 rounded border-border accent-accent"
                              />
                              Edit
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {assignments.length > 0 && (
                <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">{assignments.length} assigned</span>
                  <button
                    type="button"
                    onClick={() => setAssignments([])}
                    className="text-[10px] font-semibold text-danger hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving || savingAssignments}>
            {initialData ? "Save Changes" : "Create Goal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
