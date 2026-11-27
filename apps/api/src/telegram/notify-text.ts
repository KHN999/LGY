import type { PrismaClient } from "@lgy/db";

/**
 * Burmese Telegram line for a staff action, or null when the action is not one
 * we notify about. Covers the staff app's working tiles: sale, sale history
 * (add items, edit, payment, cancel, return), money received, send to shop,
 * cut rolls and quality upgrade.
 */
export interface ActionInfo {
  entity: string;
  /** Third path segment: void | payments | add-items | lines | method | undefined */
  sub: string | undefined;
  method: string;
  /** Id in the path, or the new record's id from the response. */
  id: string | null;
  body: Record<string, unknown>;
  username: string | null;
  shopName: string;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ks = (v: unknown): string => `${num(v).toLocaleString("en-US")} ကျပ်`;
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const int = (v: unknown): number | null => (Number.isInteger(Number(v)) && v !== null && v !== "" ? Number(v) : null);

const BANKS: Record<string, string> = { KPAY: "KPay", CB: "CB", KBZ: "KBZ", AYA: "AYA", MAB: "MAB" };
const PLACES: Record<string, string> = { WAREHOUSE: "ဂိုဒေါင်", SHOP: "ဆိုင်", IN_TRANSIT: "လမ်းမှာ", TAILOR: "ချုပ်သမား" };
const MAX_ITEMS = 6;

/** "ငွေသား" / "ဘဏ်လွှဲ KPay" / "ငွေသား 5,000 + ဘဏ်လွှဲ KPay 45,000" */
function tender(amount: number, method: unknown, bankAmount: unknown, bank: unknown): string {
  const bankName = `ဘဏ်လွှဲ${str(bank) && BANKS[str(bank)!] ? ` ${BANKS[str(bank)!]}` : ""}`;
  const viaBank = num(bankAmount);
  if (bankAmount !== undefined && bankAmount !== null && viaBank > 0 && viaBank < amount) {
    return `ငွေသား ${(amount - viaBank).toLocaleString("en-US")} + ${bankName} ${viaBank.toLocaleString("en-US")}`;
  }
  if (viaBank >= amount && viaBank > 0) return bankName;
  return str(method) && str(method) !== "CASH" ? bankName : "ငွေသား";
}

export async function notifyText(a: ActionInfo, db: PrismaClient): Promise<string | null> {
  const { entity, sub, method, body } = a;
  const id = int(a.id);
  const voided = sub === "void" || sub === "cancel";
  const reason = str(body.reason);

  const itemNames = async (ids: unknown[]): Promise<Map<number, string>> => {
    const clean = [...new Set(ids.map(int).filter((n): n is number => n !== null))];
    if (!clean.length) return new Map();
    const types = await db.itemType.findMany({ where: { id: { in: clean } }, select: { id: true, labelMy: true } });
    return new Map(types.map((t) => [t.id, t.labelMy]));
  };
  const list = (parts: string[]): string =>
    parts.slice(0, MAX_ITEMS).join("\n") + (parts.length > MAX_ITEMS ? `\n… နောက်ထပ် ${parts.length - MAX_ITEMS} မျိုး` : "");
  const saleItems = async (items: Row[]): Promise<string> => {
    const names = await itemNames(items.map((i) => i.itemTypeId));
    return list(
      items.map((i) => {
        const name = (int(i.itemTypeId) !== null ? names.get(int(i.itemTypeId)!) : str(i.itemName)) ?? "ပစ္စည်း";
        return `• ${name} — ${num(i.qty)} × ${num(i.unitPrice).toLocaleString("en-US")}`;
      }),
    );
  };
  const saleHead = async (saleId: number | null): Promise<{ who: string; total: number; paid: number } | null> => {
    if (saleId === null) return null;
    const s = await db.sale.findUnique({
      where: { id: saleId },
      select: { grandTotal: true, paidAmount: true, customerName: true, customer: { select: { name: true } } },
    });
    return s ? { who: s.customer?.name ?? s.customerName ?? "လမ်းသွား", total: s.grandTotal, paid: s.paidAmount } : null;
  };
  const customerName = async (cid: unknown): Promise<string | null> =>
    int(cid) === null ? null : ((await db.customer.findUnique({ where: { id: int(cid)! }, select: { name: true } }))?.name ?? null);
  const foot = `👤 ${a.username ?? "—"} · ${a.shopName}`;
  const msg = (...lines: (string | null | undefined | false)[]): string =>
    [...lines.filter((l): l is string => !!l), foot].join("\n");

  // ── Sales ────────────────────────────────────────────────────────
  if (entity === "sales") {
    if (method === "POST" && !sub) {
      const items = rows(body.items);
      const total = items.reduce((s, i) => s + num(i.qty) * num(i.unitPrice), 0) - num(body.discount);
      const head = await saleHead(id);
      const who = head?.who ?? str(body.customerName) ?? (await customerName(body.customerId)) ?? "လမ်းသွား";
      const handed = num(body.paidAmount);
      const forSale = Math.min(handed, total);
      return msg(
        `🛍️ အရောင်း${id !== null ? ` #${id}` : ""} — ${who}`,
        await saleItems(items),
        num(body.discount) > 0 && `လျှော့ဈေး — ${ks(body.discount)}`,
        `စုစုပေါင်း — ${ks(total)}`,
        handed > 0
          ? `ပေးငွေ — ${ks(handed)} (${tender(handed, body.paymentMethod, body.bankAmount, body.bank)})`
          : "ပေးငွေ — မပေးသေး (အကြွေး)",
        handed > total && `အဲဒီထဲက ကြွေးဟောင်း ဆပ်ငွေ — ${ks(handed - total)}`,
        total - forSale > 0 && handed > 0 && `ကျန်ငွေ — ${ks(total - forSale)}`,
      );
    }
    const head = await saleHead(id);
    const title = (icon: string, what: string) => `${icon} အရောင်း #${id ?? "?"} ${what}${head ? ` — ${head.who}` : ""}`;
    if (voided) {
      return msg(title("🚩", "ပယ်ဖျက်"), head && `စုစုပေါင်း — ${ks(head.total)}`, reason && `အကြောင်းရင်း — ${reason}`);
    }
    if (sub === "payments") {
      return msg(
        title("💵", "အတွက် ပေးငွေ"),
        `ပေးငွေ — ${ks(body.amount)} (${tender(num(body.amount), body.method, body.bankAmount, body.bank)})`,
        head && `ကျန်ငွေ — ${ks(Math.max(0, head.total - head.paid))}`,
      );
    }
    if (sub === "add-items") {
      const items = rows(body.items);
      const added = items.reduce((s, i) => s + num(i.qty) * num(i.unitPrice), 0);
      return msg(
        title("➕", "မှာ ပစ္စည်း ထပ်ထည့်"),
        await saleItems(items),
        `ထပ်တိုး — ${ks(added)}`,
        num(body.paidAmount) > 0 && `ပေးငွေ — ${ks(body.paidAmount)}`,
        head && `အရောင်း စုစုပေါင်း — ${ks(head.total)}`,
      );
    }
    if (sub === "lines") {
      const ls = rows(body.lines);
      return msg(title("✏️", "ပြင်ဆင်"), ls.length > 0 && (await saleItems(ls)), head && `စုစုပေါင်း အသစ် — ${ks(head.total)}`);
    }
    return null;
  }

  // ── Returns ──────────────────────────────────────────────────────
  if (entity === "returns") {
    if (voided) return msg(`🚩 ပြန်အမ်းမှု #${id ?? "?"} ပယ်ဖျက်`, reason && `အကြောင်းရင်း — ${reason}`);
    if (method !== "POST" || sub) return null;
    const head = await saleHead(int(body.saleId));
    const items = rows(body.items);
    const qty = items.reduce((s, i) => s + num(i.qty), 0);
    return msg(
      `↩️ ပစ္စည်း ပြန်အမ်း — အရောင်း #${int(body.saleId) ?? "?"}${head ? ` — ${head.who}` : ""}`,
      `ပြန်အမ်းတဲ့ အရေအတွက် — ${qty}`,
      num(body.refundAmount) > 0 ? `ငွေပြန်အမ်း — ${ks(body.refundAmount)}` : "ငွေပြန်မအမ်းပါ",
      str(body.notes) && `မှတ်ချက် — ${str(body.notes)}`,
    );
  }

  // ── Money received ───────────────────────────────────────────────
  if (entity === "customer-payments") {
    if (method === "POST" && !sub) {
      const who = (await customerName(body.customerId)) ?? "ဝယ်သူ";
      return msg(
        `💵 ငွေလက်ခံ — ${who}`,
        `ပမာဏ — ${ks(body.amount)} (${tender(num(body.amount), body.method, body.bankAmount, body.bank)})`,
        str(body.notes) && `မှတ်ချက် — ${str(body.notes)}`,
      );
    }
    if (id === null) return null;
    const p = await db.customerPayment.findUnique({
      where: { id },
      select: { amount: true, saleId: true, customer: { select: { name: true } } },
    });
    const what = `${p ? ks(p.amount) : `#${id}`}${p?.customer ? ` — ${p.customer.name}` : ""}`;
    if (voided) {
      return msg(`🚩 ပေးငွေ ပယ်ဖျက် — ${what}`, !!p?.saleId && `အရောင်း #${p.saleId}`, reason && `အကြောင်းရင်း — ${reason}`);
    }
    if (sub === "method") {
      const to = str(body.method) === "CASH" ? "ငွေသား" : `ဘဏ်လွှဲ${str(body.bank) ? ` ${BANKS[str(body.bank)!] ?? ""}` : ""}`;
      return msg(`🔁 ပေးငွေ ${what}`, `ပေးချေပုံ ပြောင်း → ${to}`);
    }
    return null;
  }

  // ── Send to shop ─────────────────────────────────────────────────
  if (entity === "transfers") {
    if (voided) return msg(`🚩 ပစ္စည်းပို့မှု #${id ?? "?"} ပယ်ဖျက်`, reason && `အကြောင်းရင်း — ${reason}`);
    if (method !== "POST" || sub) return null;
    const items = rows(body.items);
    const names = await itemNames(items.map((i) => i.itemTypeId));
    const place = (v: unknown) => PLACES[String(v)] ?? String(v ?? "?");
    return msg(
      `🚚 ပစ္စည်းပို့ — ${place(body.fromLocation)} → ${place(body.toLocation)}`,
      list(items.map((i) => `• ${names.get(int(i.itemTypeId) ?? -1) ?? "ပစ္စည်း"} — ${num(i.qty)}`)),
      num(body.driverFee) > 0 && `ကားခ — ${ks(body.driverFee)}`,
      str(body.notes) && `မှတ်ချက် — ${str(body.notes)}`,
    );
  }

  // ── Cut rolls ────────────────────────────────────────────────────
  if (entity === "cuts") {
    if (voided) return msg(`🚩 အလိပ်ဖြတ်မှု #${id ?? "?"} ပယ်ဖျက်`, reason && `အကြောင်းရင်း — ${reason}`);
    if (method === "PATCH") return msg(`✏️ အလိပ်ဖြတ်မှု #${id ?? "?"} ပြင်ဆင်`);
    if (method !== "POST" || sub) return null;
    const outs = rows(body.outputs);
    const names = await itemNames([body.rollItemTypeId, ...outs.map((o) => o.itemTypeId)]);
    const roll = names.get(int(body.rollItemTypeId) ?? -1) ?? "အလိပ်";
    return msg(
      `✂️ အလိပ်ဖြတ် — ${roll}${num(body.rollsUsed) > 0 ? ` ${num(body.rollsUsed)} လိပ်` : ""}`,
      outs.length > 0 && list(outs.map((o) => `• ${names.get(int(o.itemTypeId) ?? -1) ?? "ပစ္စည်း"} — ${num(o.qty)}`)),
      str(body.notes) && `မှတ်ချက် — ${str(body.notes)}`,
    );
  }

  // ── Quality upgrade ──────────────────────────────────────────────
  if (entity === "wash") {
    if (voided) return msg(`🚩 အရည်အသွေးမြှင့်မှု #${id ?? "?"} ပယ်ဖျက်`, reason && `အကြောင်းရင်း — ${reason}`);
    if (method === "PATCH") return msg(`✏️ အရည်အသွေးမြှင့်မှု #${id ?? "?"} ပြင်ဆင်`);
    if (method !== "POST" || sub) return null;
    const ls = rows(body.lines);
    const names = await itemNames(ls.flatMap((l) => [l.inputItemTypeId, l.outputItemTypeId]));
    return msg(
      "✨ အရည်အသွေး မြှင့်",
      list(
        ls.map(
          (l) =>
            `• ${names.get(int(l.inputItemTypeId) ?? -1) ?? "ပစ္စည်း"} → ${names.get(int(l.outputItemTypeId) ?? -1) ?? "ပစ္စည်း"} — ${num(l.qty)}`,
        ),
      ),
      str(body.notes) && `မှတ်ချက် — ${str(body.notes)}`,
    );
  }

  return null;
}
