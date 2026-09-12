/**
 * Tools Loading — instant skeleton shown while the Cabinet page streams.
 * Thinking Rina + pulsing placeholders matching the hero and tool grid.
 */

import Image from "next/image";

export default function ToolsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-border glass px-6 py-10 sm:flex-row sm:px-10">
        <div className="w-full flex-1 space-y-4 text-center sm:text-left">
          <div className="mx-auto h-8 w-40 rounded-lg bg-surface-2 animate-pulse sm:mx-0 sm:w-48 sm:h-10" />
          <div className="mx-auto h-3 w-3/4 rounded bg-surface-2 animate-pulse sm:mx-0" />
          <div className="mx-auto h-3 w-1/2 rounded bg-surface-2 animate-pulse sm:mx-0" />
        </div>
        <Image
          src="/rina/think.webp"
          alt="Catarina is thinking"
          width={112}
          height={112}
          className="w-24 sm:w-28 h-auto shrink-0 rounded-2xl drop-shadow-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-surface-2 animate-pulse" />
              <div className="h-4 w-24 rounded bg-surface-2 animate-pulse" />
            </div>
            <div className="h-3 w-full rounded bg-surface-2 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}