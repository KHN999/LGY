// Shown instantly during navigation between staff screens, so the tap feels
// responsive instead of leaving the old screen frozen while the server renders.
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse p-4 sm:p-8">
      <div className="mb-6 h-8 w-32 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
