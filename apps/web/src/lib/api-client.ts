/**
 * Browser-side API client. Uses the Next.js /api proxy so cookies are
 * automatically same-origin. All requests include credentials.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = await res.text().catch(() => undefined);
    }
    const msg =
      (parsed as { message?: string | string[] })?.message ||
      `${method} ${path} failed (${res.status})`;
    throw new ApiError(
      res.status,
      Array.isArray(msg) ? msg.join(", ") : msg,
      parsed,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

// ─── Domain types (mirror backend response shapes) ───────────────────

export type SaleKind = "WHOLESALE" | "RETAIL";
export type PartyStatus = "ACTIVE" | "INACTIVE";
export type Location = "WAREHOUSE" | "SHOP" | "IN_TRANSIT";

/** Isolated data spaces: the real shop vs the test/training sandbox. */
export type ShopId = "main" | "playground";
export interface ShopState {
  shop: ShopId;
  shops: ShopId[];
}

export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ItemType {
  id: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  sellable: boolean;
  /** Admin-set unit cost for valuing stock (per yard for rolls, per piece). */
  costPrice?: number | null;
  /** Admin list only: latest roll-order price/yд, offered as a default cost. */
  suggestedCost?: number | null;
}

/** One item's stock valuation row (GET /inventory/value). */
export interface StockValueRow {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  costPrice: number | null;
  warehouseQty: number;
  shopQty: number;
  /** Held by tailors (all tailors combined). */
  tailorQty: number;
  warehouseValue: number;
  shopValue: number;
  tailorValue: number;
  totalValue: number;
}

export interface StockValuation {
  items: StockValueRow[];
  totals: {
    warehouseValue: number;
    shopValue: number;
    tailorValue: number;
    totalValue: number;
    uncostedCount: number;
  };
}

/** One stock-ledger movement (GET /inventory/movements). */
export interface StockMovement {
  eventId: number;
  lineId: number;
  kind: string;
  occurredAt: string;
  itemTypeId: number;
  itemLabel: string;
  emoji: string | null;
  location: string;
  direction: "IN" | "OUT";
  qty: number;
  signedQty: number;
  balance: number | null;
  by: string | null;
  notes: string | null;
}

export interface Customer {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  defaultKind: SaleKind;
  notes: string | null;
  status: PartyStatus;
  balance: number;
}

/** A login account (admin-managed). Never includes the password hash. */
export interface ManagedUser {
  id: number;
  username: string;
  displayName: string;
  roles: string[];
  status: "ACTIVE" | "DISABLED";
  photoUrl: string | null;
  createdAt: string;
}

/** One mutating action recorded by the server-side audit interceptor. */
export interface AuditLogRow {
  id: number;
  createdAt: string;
  userId: number | null;
  username: string | null;
  shop: ShopId;
  method: string;
  path: string;
  entity: string | null;
  entityId: string | null;
  summary: string | null;
  status: number;
  ok: boolean;
  error: string | null;
  payload: unknown;
  ip: string | null;
  durationMs: number | null;
}

/** Live detail resolved from the entity an audit row points at (that row's shop),
 *  where the stored request body only has ids or can't explain the change alone. */
export interface AuditEntityContext {
  customerName?: string | null;
  supplierName?: string | null;
  itemNames?: Record<string, string>;
  stockChange?: {
    item: { name: string; emoji: string | null };
    location: string;
    recounted: boolean;
    before: number | null;
    after: number | null;
  };
  receipt?: {
    data: {
      saleId: number | null;
      date: string;
      customerName: string | null;
      customerContact: string | null;
      lines: { label: string; qty: number; unitPrice: number; lineTotal: number; note: string | null }[];
      grandTotal: number;
      paid: number;
    };
    shop: ShopSettings | null;
    voided: boolean;
  };
}

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  notes: string | null;
  status: PartyStatus;
  balance: number;
}

export interface Tailor {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  defaultFeePerPiece: number | null;
  notes: string | null;
  status: PartyStatus;
  balance: number;
  /** Money value of goods this tailor is currently holding (Σ qty × cost). */
  holdingsValue: number;
}

export interface TailorCharge {
  id: number;
  amount: number;
  pieces: number | null;
  feePerPiece: number | null;
  note: string | null;
  chargeDate: string;
  voidedAt: string | null;
}

export interface TailorPaymentRow {
  id: number;
  amount: number;
  method: string;
  notes: string | null;
  paymentDate: string;
  voidedAt: string | null;
}

export interface TailorHolding {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  qty: number;
  costPrice: number | null;
  value: number;
}

export interface TailorDetail extends Tailor {
  charges: TailorCharge[];
  payments: TailorPaymentRow[];
  holdings: TailorHolding[];
  /** Money value of the goods this tailor is holding (Σ qty × costPrice). */
  holdingsValue: number;
  /** How many held items have no cost set (holdingsValue understated). */
  holdingsUncosted: number;
}

export interface ExpenseCategory {
  id: number;
  key: string;
  labelMy: string;
  isActive: boolean;
}

export interface ExpenseRow {
  id: number;
  expenseDate: string;
  amount: number;
  paidTo: string | null;
  notes: string | null;
  category: { id: number; key: string; labelMy: string };
  paidToEmployee: { id: number; name: string } | null;
  paidToDriver: { id: number; name: string } | null;
  voidedAt: string | null;
}

export interface Driver {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  defaultFee: number | null;
  notes: string | null;
  status: PartyStatus;
}

export interface Employee {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  monthlySalary: number | null;
  notes: string | null;
  status: PartyStatus;
}

export interface StockRow {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  sortOrder?: number;
  isActive?: boolean;
  sellable?: boolean;
  qty: number;
}

/** Roll-order (supplier order) obligations at a glance. */
export interface RollOrdersSummary {
  openOrders: number;
  rollsOrdered: number;
  rollsReceived: number;
  /** Σ(expectedTotal − payments) over non-cancelled orders — total "ပေးရန်ကျန်". */
  committedToPay: number;
  /** Σ(received cost − payments) — payable for goods that have arrived. */
  dueNow: number;
}

/** One server-aggregated payload for the admin dashboard (replaces ~9 calls). */
export interface DashboardSummary {
  counts: { itemTypes: number; customers: number; suppliers: number; tailors: number };
  today: { receivedTotal: number; expectedCash: number; receivedTotalAll: number };
  debts: { customer: number; supplier: number };
  trend: { date: string; sales: number; expenses: number }[];
  expenseBreakdown: { name: string; value: number }[];
  /** Gross sales in the selected period. */
  rangeSalesTotal: number;
  /** Operating expenses (Expense table) in the period. */
  rangeExpenseTotal: number;
  /** Returns (SaleReturn.returnTotal) in the period. */
  returnsTotal: number;
  /** Gross sales − returns. */
  netSales: number;
  /** All money received in the period (every method). */
  moneyIn: number;
  /** Of moneyIn, the portion tendered as physical cash. */
  moneyInCash: number;
  /** Of moneyIn, the portion received via bank transfer. */
  moneyInBank: number;
  /** Of moneyIn, debt collected (not tied to a sale). */
  moneyInDebt: number;
  /** Of moneyIn, paid at the time of a sale. */
  moneyInOnSale: number;
  /** All money paid out in the period (supplier + tailor + expenses + refunds). */
  moneyOut: number;
  /** Total pieces sold per item type over the selected period (ranked, biggest first). */
  itemsSold: { itemTypeId: number | null; label: string; emoji: string | null; qty: number }[];
  warehouseStock: StockRow[];
  shopStock: StockRow[];
  rollOrders: RollOrdersSummary;
  /** Current on-hand stock value (warehouse + shop). */
  stockValue: number;
}

export interface SaleLine {
  id: number;
  itemTypeId: number | null;
  itemName: string | null;
  itemType?: ItemType;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
}

export interface Sale {
  id: number;
  saleDate: string;
  customerId: number | null;
  customer?: Customer;
  customerName: string | null;
  kind: SaleKind;
  goodsTotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  lines: SaleLine[];
}

export interface SalePaymentRow {
  id: number;
  amount: number;
  paymentDate: string;
  method: string;
  bank: string | null;
  notes: string | null;
}

export interface SaleDetail extends Sale {
  payments: SalePaymentRow[];
}

/** A sale that includes a given item (dashboard items-sold drill-down). */
export interface ItemSaleRow {
  id: number;
  saleDate: string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  grandTotal: number;
  paidAmount: number;
  customerName: string | null;
  itemQty: number;
  itemTotal: number;
}

export interface SaleReturnLineRow {
  id: number;
  itemTypeId: number | null;
  itemName: string | null;
  itemType?: ItemType;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SaleReturnRow {
  id: number;
  returnDate: string;
  returnTotal: number;
  refundAmount: number;
  notes: string | null;
  lines: SaleReturnLineRow[];
}

/** A row in the admin Returns list (GET /returns). */
export interface AdminReturnRow {
  id: number;
  saleId: number;
  returnDate: string;
  returnTotal: number;
  refundAmount: number;
  notes: string | null;
  voidedAt: string | null;
  customer: { id: number; name: string } | null;
  lines: {
    id: number;
    itemTypeId: number | null;
    itemName: string | null;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    itemType: { labelMy: string; emoji: string | null } | null;
  }[];
}

/** A customer's returns (GET /returns/by-customer/:id). */
export interface CustomerReturnRow {
  id: number;
  saleId: number;
  returnDate: string;
  returnTotal: number;
  refundAmount: number;
  notes: string | null;
}

export interface ShopSettings {
  shopName: string;
  addressLine: string | null;
  phone: string | null;
  social: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

export interface CustomerPayment {
  id: number;
  customerId: number | null;
  saleId: number | null;
  amount: number;
  paymentDate: string;
  method: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER";
  notes: string | null;
}

/** Response from POST /customer-payments — the payment plus the customer name
 *  and authoritative balance after, for printing the payment receipt. */
export interface PaymentResult {
  id: number;
  customerId: number | null;
  saleId: number | null;
  amount: number;
  method: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER";
  /** Bank-transfer portion of `amount` (0 = all cash; less than amount = split). */
  bankAmount: number;
  bank: string | null;
  paymentDate: string;
  notes: string | null;
  customerName: string;
  balanceAfter: number;
}

/** A received payment row for the staff "money received" history list. */
export interface ReceivedPaymentRow {
  id: number;
  amount: number;
  method: "CASH" | "BANK_TRANSFER";
  bank: string | null;
  paymentDate: string;
  saleId: number | null;
  customerId: number | null;
  customerName: string | null;
}

/** GET /customer-payments — a capped page of rows plus the TRUE total/count over
 *  the whole filtered range (so the total isn't limited to the shown rows). */
export interface PaymentHistory {
  rows: ReceivedPaymentRow[];
  total: number;
  count: number;
  /** Count and total per way of paying over the range (ignores the channel filter). */
  breakdown: PaymentChannelTotal[];
}

export interface PaymentChannelTotal {
  /** CASH, a bank code, NOBANK (transfer with no bank recorded), or another method. */
  channel: string;
  method: string;
  bank: string | null;
  count: number;
  total: number;
}

export interface DailyClosePreview {
  date: string;
  openingCash: number;
  receivedTotal: number;
  paidOutTotal: number;
  expectedCash: number;
  receivedBreakdown: { customerPayments: number; salePaidNow: number };
  paidOutBreakdown: {
    supplierPayments: number;
    tailorPayments: number;
    expenses: number;
    refunds: number;
  };
  alreadyClosed: boolean;
}

export interface DailyClose {
  id: number;
  /** Yangon business date (YYYY-MM-DD). Use this for display — closeDate is a
   *  UTC instant at Yangon midnight, so slicing its ISO is a day early. */
  date: string;
  closeDate: string;
  openingCash: number;
  receivedTotal: number;
  paidOutTotal: number;
  expectedCash: number;
  countedCash: number;
  carryForward: number;
  difference: number;
  notes: string | null;
  closedAt: string;
}

export type SupplierOrderStatus =
  | "PENDING"
  | "PARTIAL_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface SupplierOrderReceipt {
  id: number;
  orderId: number;
  receivedQty: number;
  goodsCost: number;
  transportCost: number;
  receivedAt: string;
  notes: string | null;
  voidedAt: string | null;
}

export interface SupplierOrderPayment {
  id: number;
  amount: number;
  paymentDate: string;
  method: string;
  notes: string | null;
  voidedAt: string | null;
}

export interface SupplierOrder {
  id: number;
  supplierId: number;
  supplier?: { id: number; name: string };
  itemTypeId: number;
  itemType?: ItemType;
  orderDate: string;
  status: SupplierOrderStatus;
  expectedQty: number;
  expectedYards: number | null;
  pricePerYard: number | null;
  expectedTotal: number;
  notes: string | null;
  receipts: SupplierOrderReceipt[];
  payments: SupplierOrderPayment[];
}

export interface InventoryEvent {
  id: number;
  kind: string;
  occurredAt: string;
  notes: string | null;
  voidedAt: string | null;
  lines: Array<{
    id: number;
    direction: "IN" | "OUT";
    location: "WAREHOUSE" | "SHOP" | "IN_TRANSIT" | "TAILOR";
    tailorId: number | null;
    tailor?: { id: number; name: string };
    itemTypeId: number;
    itemType?: ItemType;
    qty: number;
    unitCost: number | null;
  }>;
  createdBy?: { id: number; username: string; displayName: string };
  /** Linked expenses (e.g. a transfer's delivery fee). */
  expenses?: Array<{
    id: number;
    amount: number;
    paidTo: string | null;
    paidToDriver: { id: number; name: string } | null;
  }>;
  /** Linked tailor charges (a TAILOR_RETURN's sewing fee). */
  tailorCharges?: Array<{ id: number; amount: number; pieces: number | null }>;
  /** Events derived from this one (e.g. a TAILOR_RETURN's sewing-loss LOSS event). */
  derivedEvents?: Array<{
    id: number;
    kind: string;
    lines: Array<{
      direction: "IN" | "OUT";
      location: "WAREHOUSE" | "SHOP" | "IN_TRANSIT" | "TAILOR";
      itemTypeId: number;
      itemType?: ItemType;
      qty: number;
    }>;
  }>;
}

export interface StockExceptionSaleRef {
  saleId: number;
  qtyBeyond: number;
  saleDate: string;
  voided: boolean;
  customerName: string | null;
}

export interface StockExceptionRow {
  id: number;
  itemType: { id: number; key: string; labelMy: string; emoji: string | null };
  location: "WAREHOUSE" | "SHOP" | "IN_TRANSIT" | "TAILOR";
  status: "OPEN" | "RESOLVED";
  /** Live computed stock (negative = shortfall). Source of truth is the ledger. */
  currentStock: number;
  soldBeyondTotal: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  sales: StockExceptionSaleRef[];
}

export interface StatementTxn {
  date: string;
  type: string;
  description: string;
  in: number;
  out: number;
  balance: number;
}
export interface Statement {
  from: string;
  to: string;
  openingCash: number;
  closingCash: number;
  totalIn: number;
  totalOut: number;
  salesTotal: number;
  salesCount: number;
  transactions: StatementTxn[];
}

export interface SalesReportRow {
  id: number;
  date: string;
  customer: string;
  kind: string;
  grandTotal: number;
  paid: number;
  remaining: number;
  status: string;
}
export interface SalesReport {
  from: string;
  to: string;
  rows: SalesReportRow[];
  count: number;
  totalGrand: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface DebtorRow {
  id: number;
  name: string;
  contact: string | null;
  balance: number;
}
export interface DebtorsReport {
  rows: DebtorRow[];
  total: number;
  count: number;
}

/** An invoice in a deleted-customer case: when it is dated and when it was typed in. */
export interface CaseInvoice { id: number; saleDate: string; enteredAt: string; total: number }

/** GET /analytics/overview — whole-business figures for /data-analysis. */
export interface AnalyticsOverview {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  totals: {
    revenue: number; orders: number; avgOrder: number; collected: number; walkinRevenue: number;
    accountRevenue: number; saleDays: number; revenuePerDay: number;
  };
  monthly: {
    month: string; orders: number; revenue: number; days: number; walkinRevenue: number;
    collected: number; cash: number; bank: number; debtCollected: number;
  }[];
  weekly: { week: string; orders: number; revenue: number }[];
  weekdays: { dow: number; orders: number; revenue: number }[];
  products: {
    itemTypeId: number; label: string; qty: number; revenue: number; share: number; avgPrice: number;
    costPrice: number | null; marginPct: number | null; belowCost: boolean; grossProfit: number | null;
    qty30: number; onHand: number; atTailors: number; daysCover: number | null;
  }[];
  productCount: number;
  nonCatalog: { lines: number; revenue: number };
  profit: {
    costedRevenue: number; costedShare: number; grossProfit: number; marginPct: number | null;
    expenseTotal: number; expenses: number; tailorCharged: number;
  };
  customers: {
    total: number; buyers: number; active30: number; active90: number; oneOrder: number;
    top1Share: number; top5Share: number; top20Share: number;
    top: { id: number; name: string; orders: number; revenue: number; balance: number; lastSale: string | null }[];
  };
  receivables: {
    total: number; debtors: number; top1Share: number;
    aging: Record<"d0_30" | "d31_60" | "d61_90" | "d90plus", { count: number; amount: number }>;
    top: {
      id: number; name: string; balance: number; lastSale: string | null; lastPayment: string | null;
      daysSincePayment: number | null;
    }[];
    inCredit: {
      count: number; amount: number;
      list: {
        id: number; name: string; orders: number; bought: number; paid: number; credit: number;
        lastPayment: string | null; reason: "NO_SALES" | "PAID_TWICE" | "OVERPAID"; sameName: boolean;
      }[];
    };
    deleted: {
      customers: number; revenue: number; unpaidCount: number; unpaid: number;
      list: {
        id: number; name: string; createdAt: string; deletedAt: string | null;
        revenue: number; paid: number; unpaid: number; lateOrders: number; lateRevenue: number;
        invoices: CaseInvoice[];
        twin: {
          id: number; createdAt: string; revenue: number; paid: number; balance: number;
          invoices: CaseInvoice[]; matchesUnpaid: boolean;
        } | null;
      }[];
    };
  };
  payments: { mix: { method: string; bank: string | null; count: number; total: number }[] };
  payables: {
    supplierOrdered: number; supplierPaid: number; supplierOwed: number;
    tailorCharged: number; tailorPaid: number; tailorOwed: number;
  };
  stock: {
    totals: { warehouseValue: number; shopValue: number; tailorValue: number; totalValue: number; uncostedCount: number };
    idle: { label: string; qty: number; value: number }[];
    idleValue: number;
    negative: { label: string; warehouseQty: number; shopQty: number }[];
  };
  flow: ({ month: string } & Record<
    "RECEIPT" | "CUT" | "TAILOR_SEND" | "TAILOR_RETURN" | "TRANSFER",
    { events: number; qty: number }
  >)[];
  hygiene: {
    sales: number; voidedSales: number; saleDays: number; closedSaleDays: number; closes: number;
    closesOff: number; closeDiff: number; openExceptions: number; expenses: number; returns: number;
    returnTotal: number; refundTotal: number; uncostedItems: number;
  };
}

/** GET /customers/:id/statement — one customer's account for a period. */
export interface CustomerStatement {
  customer: { id: number; name: string; contact: string | null; deleted: boolean };
  from: string | null;
  to: string | null;
  firstDate: string | null;
  opening: number;
  closing: number;
  totals: {
    sales: number; salesCount: number; payments: number; paymentsCount: number; returned: number; refunded: number;
  };
  rows: {
    date: string;
    kind: "SALE" | "PAYMENT" | "RETURN";
    refId: number;
    saleId: number | null;
    debit: number;
    credit: number;
    method: string | null;
    bank: string | null;
    items: { label: string; qty: number; unitPrice: number }[];
    balance: number;
  }[];
}
