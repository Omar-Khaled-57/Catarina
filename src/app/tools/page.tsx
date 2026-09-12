/**
 * Tools Page — The Cabinet hub. Playful hero with a greeting Rina and the
 * tool grid; full-page sleeping-Rina state if the registry is ever empty.
 */

"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { getTools } from "@/lib/tools";
import ToolGrid from "@/components/tools/ToolGrid";

export default function ToolsPage() {
  const tools = getTools();
  const reduceMotion = useReducedMotion();

  if (tools.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <Image
          src="/rina/sleeping.webp"
          alt="Catarina is sleeping"
          width={160}
          height={160}
          className="w-32 sm:w-40 h-auto mb-4 rounded-2xl drop-shadow-sm"
        />
        <p className="text-lg font-semibold text-text">The Cabinet is empty</p>
        <p className="mt-1 text-sm text-text-muted">Catarina is building the first tool.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="glass relative overflow-hidden rounded-3xl border border-border px-6 py-10 sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-art/25 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-text sm:text-5xl">
              The Cabinet
            </h1>
            <p className="mt-3 max-w-xl text-sm text-text-muted sm:text-base">
              Everything your team reaches for, in one playful place — drawers
              of reusable stuff, the team table, and more tools on the way.
            </p>
          </div>
          <motion.div
            animate={reduceMotion ? { y: 0 } : { y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0"
          >
            <Image
              src="/rina/role-changed.webp"
              alt="Catarina greeting you from the Cabinet"
              width={192}
              height={192}
              className="w-40 sm:w-48 h-auto rounded-2xl drop-shadow-sm"
            />
          </motion.div>
        </div>
      </section>

      <ToolGrid />
    </div>
  );
}