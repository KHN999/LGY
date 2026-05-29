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
};

// ─── Domain types (mirror backend response shapes) ───────────────────

export type SaleKind = "WHOLESALE" | "RETAIL";
export type PartyStatus = "ACTIVE" | "INACTIVE";
export type Location = "WAREHOUSE" | "SHOP" | "IN_TRANSIT";

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
  qty: number;
}

export interface SaleLine {
  id: number;
  itemTypeId: number;
  itemType?: ItemType;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: number;
  saleDate: string;
  customerId: number;
  customer?: Customer;
  kind: SaleKind;
  goodsTotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  notes: string | null;
  voidedAt: string | null;
  lines: SaleLine[];
}

export interface CustomerPayment {
  id: number;
  customerId: number;
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
  };
  alreadyClosed: boolean;
}

export interface DailyClose {
  id: number;
  closeDate: string;
  openingCash: number;
  receivedTotal: number;
  paidOutTotal: number;
  expectedCash: number;
  countedCash: number;
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
}

export interface SupplierOrderPayment {
  id: number;
  amount: number;
  paymentDate: string;
  method: string;
  notes: string | null;
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
}

export interface StockExceptionSaleRef {
  saleId: number;
  qtyBeyond: number;
  saleDate: string;
  voided: boolean;
  customerName: string;
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
