"use client";

/**
 * GoalForm — Create/Edit goal modal with assignments picker.
 */

import { useState, useEffect, useMemo, useRef } from "react";
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

const wasOpenRef = useRef(false);
  const initialDataRef = useRef(initialData);
  const initialAssignmentsRef = useRef<GoalAssignmentData[]>([]);
  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  useEffect(() => {
    /* Reset only on the closed→open transition. Depending on `initialData`
     * identity would wipe in-progress edits whenever the parent re-renders
     * (e.g. realtime merge bumps the generation while typing). */
    const opening = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!opening) return;

    const data = initialDataRef.current;
    if (data) {
      setName(data.name || "");
      setDescription(data.description || "");
      setCurrent(data.current ?? 0);
      setTarget(data.target ?? 1);
      setDeadline(data.deadline || "");
      setMonthId(data.monthId || "");
      setAssignments(data.assignments || []);
      initialAssignmentsRef.current = data.assignments || [];
    } else {
      setName("");
      setDescription("");
      setCurrent(0);
      setTarget(1);
      setDeadline("");
      setAssignments([]);
      initialAssignmentsRef.current = [];
    }
    setShowAssignments(false);
    setUserSearch("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/months")
      .then((r) => r.json())
      .then((d) => setMonths((d.months || []).filter((m: { isArchived?: boolean }) => !m.isArchived)))
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
    if (isSaving) return; /* prevent duplicate submits while a save is pending */
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

      const targetId = goalId || newGoalId;
      /* Persist assignments whenever they changed — including clearing the
       * whole list (a no-op-only save for create-with-nobody-assigned is
       * skipped by the equality check below). */
      const assignmentsChanged =
        targetId &&
        JSON.stringify(assignments) !== JSON.stringify(initialAssignmentsRef.current);

      if (targetId && assignmentsChanged) {
        setSavingAssignments(true);
        try {
          await onSaveAssignments(targetId, assignments);
        } catch {
          /* The goal itself saved fine — do NOT keep the modal open for a
           * re-submit, that would create a duplicate goal. Tell the user to
           * fix assignments from the goal card instead. */
          toast.error(
            goalId
              ? "Changes saved, but assignments couldn't be updated. Retry from the goal card."
              : "Goal created, but assignments couldn't be saved. Assign members from the goal card."
          );
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
              Month {goalId && <span className="font-normal text-text-muted/60">(fixed after creation)</span>}
            </label>
            {/* A goal's month is fixed at creation — allow choosing only when it's a new goal. */}
            <select
              id="goal-month"
              value={monthId}
              onChange={(e) => setMonthId(e.target.value)}
              disabled={!!goalId}
              className="w-full text-sm rounded-xl bg-surface-2 border border-border px-3 py-2 text-text focus:outline-none focus:border-accent select-glass disabled:opacity-60 disabled:cursor-not-allowed"
              required
            >
              {months.length === 0 && monthId ? (
                <option value={monthId}>Current month</option>
              ) : (
                <>
                  <option value="">Select month</option>
                  {months.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </>
              )}
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
                          className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-lg border-2 transition-all ${
                            assigned
                              ? "border-accent bg-accent text-bg checkbox-pulse"
                              : "border-text-muted/30 hover:border-accent/50"
                          }`}
                          aria-label={`Assign ${u.name}`}
                          aria-pressed={assigned}
                        >
                          {assigned && <Check size={11} strokeWidth={3} />}
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateAssignment(u.id, "canCheck", !assignment?.canCheck)}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all ${
                                assignment?.canCheck
                                  ? "border-accent bg-accent/15 text-accent"
                                  : "border-border text-text-muted hover:border-accent/40"
                              }`}
                            >
                              Check
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAssignment(u.id, "canEdit", !assignment?.canEdit)}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all ${
                                assignment?.canEdit
                                  ? "border-art bg-art/15 text-art"
                                  : "border-border text-text-muted hover:border-art/40"
                              }`}
                            >
                              Edit
                            </button>
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
