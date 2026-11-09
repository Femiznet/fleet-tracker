export default function PageLoading({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}
