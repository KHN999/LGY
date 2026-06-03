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
}

export interface TailorDetail extends Tailor {
  charges: TailorCharge[];
  payments: TailorPaymentRow[];
  holdings: TailorHolding[];
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
  today: { receivedTotal: number; expectedCash: number };
  debts: { customer: number; supplier: number };
  trend: { date: string; sales: number; expenses: number }[];
  expenseBreakdown: { name: string; value: number }[];
  rangeSalesTotal: number;
  rangeExpenseTotal: number;
  warehouseStock: StockRow[];
  shopStock: StockRow[];
  rollOrders: RollOrdersSummary;
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
  notes: string | null;
}

export interface SaleDetail extends Sale {
  payments: SalePaymentRow[];
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
