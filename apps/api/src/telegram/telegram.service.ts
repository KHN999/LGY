import { Injectable, Logger } from "@nestjs/common";

export interface TelegramChat {
  id: string;
  title: string;
  type: string;
}

const MAX_TRIES = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One-way Telegram notifications. LGY only ever SENDS; nothing typed in
 * Telegram can change LGY data.
 *
 * Configured purely by environment (never the repo, never the database):
 *   TELEGRAM_BOT_TOKEN  — the bot's token from BotFather
 *   TELEGRAM_CHAT_ID    — the group (or person) that receives the messages
 * With either one missing every call is a silent no-op, so the feature is off
 * by default and the app runs exactly as before.
 *
 * Sending never blocks or fails the action that triggered it: messages go
 * through an in-memory queue, one at a time, with a few retries. A message that
 * still fails is dropped and logged — the audit log remains the full record.
 */
@Injectable()
export class TelegramService {
  private readonly log = new Logger("Telegram");
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  private readonly chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "";
  private readonly base = (process.env.TELEGRAM_API_URL?.trim() || "https://api.telegram.org").replace(/\/+$/, "");
  private queue: Promise<void> = Promise.resolve();

  get enabled(): boolean {
    return !!this.token && !!this.chatId;
  }

  /** Queue a message. Returns immediately; never throws. */
  notify(text: string): void {
    if (!this.enabled || !text.trim()) return;
    this.queue = this.queue.then(() => this.deliver(text)).catch(() => undefined);
  }

  /** Send now and report the outcome (used by the admin "send test" button). */
  async sendNow(text: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.enabled) return { ok: false, error: "Telegram is not set up" };
    return this.call("sendMessage", { chat_id: this.chatId, text, disable_web_page_preview: true });
  }

  async status(): Promise<{ hasToken: boolean; hasChat: boolean; enabled: boolean; botUsername: string | null; error?: string }> {
    const out = { hasToken: !!this.token, hasChat: !!this.chatId, enabled: this.enabled, botUsername: null as string | null };
    if (!this.token) return out;
    const me = await this.call<{ username?: string }>("getMe", {});
    return me.ok ? { ...out, botUsername: me.result?.username ?? null } : { ...out, error: me.error };
  }

  /** Chats the bot has recently seen — lets the admin find the group's id. */
  async chats(): Promise<{ chats: TelegramChat[]; error?: string }> {
    if (!this.token) return { chats: [], error: "TELEGRAM_BOT_TOKEN is not set" };
    type Chat = { id: number; title?: string; first_name?: string; username?: string; type: string };
    type Update = { message?: { chat: Chat }; my_chat_member?: { chat: Chat }; channel_post?: { chat: Chat } };
    const r = await this.call<Update[]>("getUpdates", { limit: 100, timeout: 0 });
    if (!r.ok) return { chats: [], error: r.error };
    const seen = new Map<string, TelegramChat>();
    for (const u of r.result ?? []) {
      const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
      if (!c) continue;
      seen.set(String(c.id), { id: String(c.id), title: c.title ?? c.first_name ?? c.username ?? "—", type: c.type });
    }
    return { chats: [...seen.values()] };
  }

  private async deliver(text: string): Promise<void> {
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      const r = await this.call("sendMessage", { chat_id: this.chatId, text, disable_web_page_preview: true });
      if (r.ok) return;
      // A refusal that retrying cannot fix (bad chat id, bot removed, bad token).
      if (r.status && r.status >= 400 && r.status < 500 && r.status !== 429) {
        this.log.error(`message dropped: ${r.error}`);
        return;
      }
      if (attempt < MAX_TRIES) await sleep(Math.min(30_000, (r.retryAfter ?? attempt * 2) * 1000));
      else this.log.error(`message dropped after ${MAX_TRIES} tries: ${r.error}`);
    }
  }

  private async call<T = unknown>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; result?: T; error?: string; status?: number; retryAfter?: number }> {
    try {
      const res = await fetch(`${this.base}/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } }
        | null;
      if (res.ok && json?.ok) return { ok: true, result: json.result };
      return {
        ok: false,
        status: res.status,
        error: json?.description ?? `HTTP ${res.status}`,
        retryAfter: json?.parameters?.retry_after,
      };
    } catch (e) {
      // Never echo the request URL — it contains the token.
      return { ok: false, error: e instanceof Error ? e.name : "network error" };
    }
  }
}
