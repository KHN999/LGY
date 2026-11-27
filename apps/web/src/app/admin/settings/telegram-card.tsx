"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Button, Card } from "@/components/ui";

const L = labels.telegram;
interface Status {
  hasToken: boolean;
  hasChat: boolean;
  enabled: boolean;
  botUsername: string | null;
  error?: string;
}
interface Chat {
  id: string;
  title: string;
  type: string;
}

/** Shows whether the Telegram bot is connected, helps find the group's id, and
 *  sends a test message. The token itself is never shown or entered here — it
 *  lives only in the server's settings. */
export function TelegramCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .get<Status>("/telegram/status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function findChats() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.get<{ chats: Chat[]; error?: string }>("/telegram/chats");
      setChats(r.chats);
      if (r.error) setNote({ ok: false, text: r.error });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError ? err.message : labels.errors.unknown });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.post<{ ok: boolean; error?: string }>("/telegram/test", {});
      setNote(r.ok ? { ok: true, text: L.testSent } : { ok: false, text: `${L.testFailed} ${r.error ?? ""}` });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError ? err.message : labels.errors.unknown });
    } finally {
      setBusy(false);
    }
  }

  const pill = (ok: boolean, text: string) => (
    <span
      className={
        "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (ok ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900")
      }
    >
      {ok ? "✓" : "○"} {text}
    </span>
  );

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-base font-semibold">✈️ {L.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{L.help}</p>
      </div>
      {status && (
        <div className="flex flex-wrap gap-2">
          {pill(status.hasToken, status.botUsername ? `bot @${status.botUsername}` : L.token)}
          {pill(status.hasChat, L.chat)}
          {pill(status.enabled, status.enabled ? L.on : L.off)}
        </div>
      )}
      {status?.error && <p className="text-sm text-destructive">{status.error}</p>}
      {status && !status.enabled && (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          {L.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy || !status?.hasToken} onClick={findChats}>
          {L.findChats}
        </Button>
        <Button type="button" size="sm" disabled={busy || !status?.enabled} onClick={sendTest}>
          {L.sendTest}
        </Button>
      </div>
      {chats && (
        <ul className="flex flex-col divide-y rounded-xl border text-sm">
          {chats.length === 0 && <li className="p-3 text-muted-foreground">{L.noChats}</li>}
          {chats.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="min-w-0 truncate">
                {c.title} <span className="text-xs text-muted-foreground">({c.type})</span>
              </span>
              <code className="select-all rounded bg-muted px-2 py-0.5 tabular-nums">{c.id}</code>
            </li>
          ))}
        </ul>
      )}
      {note && <p className={"text-sm " + (note.ok ? "text-emerald-700" : "text-destructive")}>{note.text}</p>}
    </Card>
  );
}
