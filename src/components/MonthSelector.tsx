"use client";

/**
 * MonthSelector — Navigation for switching between planning months.
 * Shows current month with prev/next arrows.
 * Admin can create new months (with carry-over logic).
 */

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { monthNameLine1, monthNameLine2 } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Image from "next/image";

interface MonthData {
  id: string;
  name: string;
  year: number;
  month: number;
  isArchived: boolean;
}

interface MonthSelectorProps {
  currentMonthId: string | null;
  onSelectMonth: (monthId: string) => void;
  showCreate?: boolean;
}

export default function MonthSelector({
  currentMonthId,
  onSelectMonth,
  showCreate = true,
}: MonthSelectorProps) {
  const { isAdmin } = useAuth();
  const [months, setMonths] = useState<MonthData[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  /* Fetch all months */
  useEffect(() => {
    fetch("/api/months")
      .then((res) => res.json())
      .then((data) => setMonths(data.months || []))
      .catch(() => {});
  }, []);

  const currentIndex = months.findIndex((m) => m.id === currentMonthId);
  const currentMonth = months[currentIndex];

  const goToPrev = () => {
    if (currentIndex > 0) onSelectMonth(months[currentIndex - 1].id);
  };
  const goToNext = () => {
    if (currentIndex < months.length - 1)
      onSelectMonth(months[currentIndex + 1].id);
  };

  /* Create a new month with carry-over of unfinished goals */
  const handleCreateMonth = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/months/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousMonthId: currentMonthId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMonths((prev) => [...prev, data.month]);
        onSelectMonth(data.month.id);
        toast.success(
          data.carriedOver > 0
            ? `New month created with ${data.carriedOver} carried-over goals`
            : "New month created"
        );
      } else {
        toast.error(data.error || "Failed to create month");
      }
    } catch {
      toast.error("Failed to create month");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      {/* Month Navigation */}
      <div className="flex items-center justify-center sm:justify-start gap-3">
        <button
          onClick={goToPrev}
          disabled={currentIndex <= 0}
          className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-text min-w-[120px] sm:min-w-[160px] text-center">
          {currentMonth ? (
            <>
              <span>{monthNameLine1(currentMonth.month, currentMonth.year)}</span>
              <br />
              <span className="text-sm font-medium text-text-muted">{monthNameLine2(currentMonth.month)}</span>
            </>
          ) : "No Month Selected"}
        </h2>
        <button
          onClick={goToNext}
          disabled={currentIndex >= months.length - 1 || currentIndex < 0}
          className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-text transition-colors disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Create New Month (Admin Only) */}
      {isAdmin && showCreate && (
        <Button
          onClick={handleCreateMonth}
          isLoading={isCreating}
          variant="outline"
          className="gap-1.5 sm:gap-2 px-3 sm:px-5 py-2"
        >
          <Plus size={16} />
          <span className="text-xs sm:text-sm">New Month</span>
        </Button>
      )}
    </div>
  );
}
