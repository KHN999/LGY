import Link from "next/link";
import { labels } from "@/lib/labels";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">{labels.common.appName}</h1>
      <p className="text-muted-foreground">Theingyi longyi management</p>
      <div className="flex gap-4">
        <Link
          href="/staff"
          className="rounded-lg bg-primary px-6 py-4 text-lg text-primary-foreground"
        >
          {labels.nav.staff}
        </Link>
        <Link href="/admin" className="rounded-lg border px-6 py-4 text-lg">
          {labels.nav.admin}
        </Link>
      </div>
    </main>
  );
}
