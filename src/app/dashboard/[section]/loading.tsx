/**
 * Section Page Loading — Instant skeleton for the section goals view.
 */

export default function SectionLoading() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-surface-2 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-32 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-48 rounded bg-surface-2 animate-pulse" />
        </div>
      </div>
      {/* Goals grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-md bg-surface-2 animate-pulse" />
              <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
            </div>
            <div className="h-2 w-full rounded bg-surface-2 animate-pulse" />
            <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
