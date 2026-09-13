// DELETE /api/months/[id] — Hide an active planning month (admin only)
// Soft-delete: sets isArchived = true so goals, steps, comments and archives
// stay intact and the month remains browsable in the archive report.

import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const existing = await prisma.month.findUnique({
      where: { id },
      select: { isArchived: true },
    });
    if (!existing) return jsonError("Month not found", 404);

    /* Re-archiving an already-archived month is a no-op success */
    if (existing.isArchived) {
      return NextResponse.json({ success: true, archived: true });
    }

    await prisma.month.update({
      where: { id },
      data: { isArchived: true },
    });
    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    console.error("Error archiving month:", error);
    return jsonError("Failed to archive month", 500);
  }
}
