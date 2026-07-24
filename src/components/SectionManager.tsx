"use client";

/**
 * SectionManager — Admin UI for managing team sections.
 * Features: create, edit, delete sections, color picker, prefix customization.
 */

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ColorPicker from "@/components/ColorPicker";
import { Plus, Pencil, Trash2, GripVertical, Palette } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface SectionConfig {
  id: string;
  key: string;
  label: string;
  prefix: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export default function SectionManager() {
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionConfig | null>(null);
  const [deletingSection, setDeletingSection] = useState<SectionConfig | null>(null);

  const fetchSections = async () => {
    try {
      const res = await fetch("/api/admin/sections");
      const data = await res.json();
      if (data.sections) {
        setSections(data.sections);
      } else {
        /* Fallback to public endpoint */
        const pubRes = await fetch("/api/sections");
        const pubData = await pubRes.json();
        setSections(pubData.sections || []);
      }
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleCreate = async (data: { key: string; label: string; prefix: string; color: string }) => {
    const res = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Section created");
      fetchSections();
      setShowCreate(false);
    } else {
      const d = await res.json();
      toast.error(d.error || "Failed to create section");
    }
  };

  const handleUpdate = async (id: string, data: { label: string; prefix: string; color: string }) => {
    const res = await fetch(`/api/admin/sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Section updated");
      fetchSections();
      setEditingSection(null);
    } else {
      const d = await res.json();
      toast.error(d.error || "Failed to update section");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/sections/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Section removed");
      fetchSections();
      setDeletingSection(null);
    } else {
      toast.error("Failed to remove section");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Palette size={16} className="text-accent" />
            Team Sections
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Manage sections, colors, and ID prefixes
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="text-xs">
          <Plus size={14} />
          New Section
        </Button>
      </div>

      {sections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-center py-8 text-text-muted"
        >
          <Palette size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No sections</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {sections.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50 border border-border/30 group hover:border-border/60 transition-colors"
              >
              {/* Color dot */}
              <div
                className="h-8 w-8 rounded-lg shrink-0"
                style={{ backgroundColor: s.color }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-text">{s.label}</span>
                  <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface border border-border/30">
                    {s.key}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-text-muted">
                    Prefix: <span className="font-mono font-bold text-text">{s.prefix}</span>
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Color: <span className="font-mono" style={{ color: s.color }}>{s.color}</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setEditingSection(s)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  title="Edit section"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeletingSection(s)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  title="Remove section"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        </AnimatePresence>
      )}

      {/* Create Modal */}
      {showCreate && (
        <SectionFormModal
          title="Create Section"
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editingSection && (
        <SectionFormModal
          title={`Edit ${editingSection.label}`}
          initial={editingSection}
          onClose={() => setEditingSection(null)}
          onSave={(data) => handleUpdate(editingSection.id, data)}
        />
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deletingSection}
        onClose={() => setDeletingSection(null)}
        title="Remove Section"
      >
        <p className="text-sm text-text-muted mb-4">
          Are you sure you want to remove <strong className="text-text">{deletingSection?.label}</strong>?
          Goals in this section will still exist but the section won't appear in new goal creation.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeletingSection(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => deletingSection && handleDelete(deletingSection.id)}
            className="bg-danger hover:bg-danger/90 text-white"
          >
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Section Form Modal ────────────────────────────────────────────────── */
function SectionFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: { key: string; label: string; prefix: string; color: string };
  onClose: () => void;
  onSave: (data: { key: string; label: string; prefix: string; color: string }) => void;
}) {
  const [key, setKey] = useState(initial?.key || "");
  const [label, setLabel] = useState(initial?.label || "");
  const [prefix, setPrefix] = useState(initial?.prefix || "");
  const [color, setColor] = useState(initial?.color || "#FF4D6A");
  const [isSaving, setIsSaving] = useState(false);
  const isNew = !initial;

  /* Auto-generate key and prefix from label */
  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (isNew) {
      const autoKey = val.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
      setKey(autoKey);
      const autoPrefix = autoKey.slice(0, 3) + "-";
      setPrefix(autoPrefix);
    }
  };

  const handleSave = async () => {
    if (!key || !label || !prefix) {
      toast.error("All fields are required");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ key, label, prefix, color });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* Label */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Section Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. Design, HR, Finance"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        {/* Key */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Section Key
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            placeholder="e.g. DESIGN, HR, FINANCE"
            disabled={!isNew}
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-50"
          />
          <p className="text-[10px] text-text-muted/60 mt-1">Uppercase letters only. Used internally.</p>
        </div>

        {/* Prefix */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Goal ID Prefix
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="e.g. DES-, HR-, FIN-"
            className="w-full rounded-xl bg-surface-2 border border-border/60 px-4 py-2.5 text-sm text-text font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
          <p className="text-[10px] text-text-muted/60 mt-1">Goals will be numbered like {prefix || "XXX-"}001, {prefix || "XXX-"}002, etc.</p>
        </div>

        {/* Color */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Section Color
          </label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            {isNew ? "Create Section" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
