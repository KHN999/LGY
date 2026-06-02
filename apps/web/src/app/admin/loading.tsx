// Shown instantly during navigation to any /admin page (renders inside the
// AdminShell content slot), so the screen never freezes on the old page.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-8 w-40 rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}
