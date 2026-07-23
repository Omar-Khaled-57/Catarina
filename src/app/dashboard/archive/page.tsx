"use client";

/**
 * Archive Page — Lists past months with archived PDF reports.
 * Admins can click into the full pad; members can download the PDF directly.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { monthNameLine1, monthNameLine2, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Download, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MonthData {
  id: string;
  name: string;
  year: number;
  month: number;
  isArchived: boolean;
  createdAt: string;
  _count: { goals: number };
}

export default function ArchivePage() {
  const { isAdmin } = useAuth();
  const [months, setMonths] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/months")
      .then((res) => res.json())
      .then((data) => {
        setMonths(data.months || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleDeleteMonth = async (monthId: string, monthName: string) => {
    if (!confirm(`Are you sure you want to delete ${monthName}? All goals will be lost.`)) return;
    try {
      const res = await fetch(`/api/months/${monthId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Month deleted successfully");
        setMonths((prev) => prev.filter(m => m.id !== monthId));
      } else {
        toast.error("Failed to delete month");
      }
    } catch {
      toast.error("Failed to delete month");
    }
  };

  return (
    <div className="space-y-6 px-4 sm:px-5 lg:px-6 py-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-text tracking-tight">
          Archive
        </h1>
        <p className="text-sm text-text-muted mt-0.5">
          Past months and their planning reports
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : months.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg font-semibold">No months yet</p>
          <p className="text-sm mt-1">
            Create a month from the dashboard to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {months
            .slice()
            .reverse()
            .map((m) => (
              <Card key={m.id} hover className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-text">
                    {monthNameLine1(m.month, m.year)}
                    <br />
                    <span className="text-sm font-medium text-text-muted">
                      {monthNameLine2(m.month)}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMonth(m.id, monthNameLine1(m.month, m.year))}
                        className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete Month"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {m.isArchived ? (
                      <Badge variant="success">Archived</Badge>
                    ) : (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-text-muted mb-1">
                  {m._count.goals} goals
                </p>
                <p className="text-xs text-text-muted mb-3">
                  Created {formatDate(m.createdAt)}
                </p>
                <div className="mt-auto">
                  {isAdmin ? (
                    <Link
                      href={`/dashboard/archive/${m.id}`}
                      className="flex items-center justify-between w-full rounded-xl bg-accent/10 border border-accent/20 px-4 py-2.5 text-xs font-bold text-accent transition-all hover:bg-accent/20"
                    >
                      <span>Open Report</span>
                      <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <span className="flex items-center justify-between w-full rounded-xl bg-surface-2/60 border border-border/30 px-4 py-2.5 text-xs font-semibold text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Download size={12} />
                        View PDF in report
                      </span>
                    </span>
                  )}
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
