/**
 * ToolGrid — renders the tool registry as a responsive card grid.
 * When no coming-soon tools are registered, a single placeholder card keeps
 * the "Catarina is building this" slot visible.
 */

"use client";

import { Sparkles } from "lucide-react";
import type { ToolMeta } from "@/lib/tools";
import { getTools } from "@/lib/tools";
import ToolCard from "@/components/tools/ToolCard";

export default function ToolGrid() {
  const tools = getTools();

  if (tools.length === 0) return null;

  const cards: ToolMeta[] = [...tools];

  if (!cards.some((t) => t.status === "coming-soon")) {
    cards.push({
      id: "coming-soon-slot",
      name: "Coming soon",
      tagline: "",
      href: "#",
      icon: Sparkles,
      accent: "#00E8A2",
      status: "coming-soon",
      comingSoonNote: "Catarina is building this",
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}