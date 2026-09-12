/**
 * ToolCard — cabinet tool grid card. Live tools are links with a springy
 * lift; coming-soon tools render as a disabled card with an editing Rina.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { ToolMeta } from "@/lib/tools";
import { COMING_SOON_TEXT } from "@/lib/tools";

const cardSpring = { type: "spring", stiffness: 320, damping: 22 } as const;

export default function ToolCard({ tool }: { tool: ToolMeta }) {
  const isLive = tool.status === "live";
  const Icon = tool.icon;

  if (!isLive) {
    return (
      <div className="cabinet-coming-soon relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl bg-surface/40 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-text-muted">
            <Icon size={20} />
          </div>
          <p className="text-base font-semibold text-text">{tool.name}</p>
        </div>
        <p className="mt-3 max-w-[75%] text-xs leading-relaxed text-text-muted">
          {tool.comingSoonNote ?? COMING_SOON_TEXT}
        </p>
        <Image
          src="/rina/edit.webp"
          alt="Catarina is working on the next tool"
          width={112}
          height={112}
          className="absolute right-4 bottom-4 w-28 sm:w-32 h-auto rounded-xl drop-shadow-sm -scale-x-100"
        />
      </div>
    );
  }

  return (
    <Link href={tool.href} className="group block h-full">
      <motion.div
        whileHover={{ y: -4 }}
        whileTap={{ y: 0, scale: 0.99 }}
        transition={cardSpring}
        style={{ "--tool-accent": tool.accent } as CSSProperties}
        className="glass group flex h-full flex-col rounded-2xl border border-border p-5 transition-colors duration-200 group-hover:border-[color:var(--tool-accent)] group-hover:shadow-[0_0_24px_-8px_var(--tool-accent)]"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${tool.accent}1F`,
              color: tool.accent,
            }}
          >
            <Icon size={22} />
          </div>
          <p className="flex-1 text-base font-semibold text-text">{tool.name}</p>
          <ChevronRight
            size={18}
            className="text-text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[color:var(--tool-accent)]"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">{tool.tagline}</p>
        <div
          aria-hidden="true"
          className="mt-auto pt-4 h-1 w-10 rounded-full"
          style={{ backgroundColor: tool.accent }}
        />
      </motion.div>
    </Link>
  );
}