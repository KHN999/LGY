"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InventoryEvent, ShopSettings } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { TransferReceipt, type TransferSlip } from "@/components/staff/transfer-receipt";

const LOC: Record<string, string> = {
  WAREHOUSE: labels.transfer.locWarehouse,
  SHOP: labels.transfer.locShop,
  IN_TRANSIT: labels.transfer.locInTransit,
  TAILOR: "Tailor",
};

export function TransferView({
  transfer,
  shop,
  autoPrint = false,
}: {
  transfer: InventoryEvent;
  shop?: ShopSettings;
  autoPrint?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const printedRef = useRef(false);
  useEffect(() => setMounted(true), []);

  const outLines = transfer.lines.filter((l) => l.direction === "OUT");
  const inLine = transfer.lines.find((l) => l.direction === "IN");

  const data: TransferSlip = {
    transferId: transfer.id,
    date: transfer.occurredAt,
    fromLabel: LOC[outLines[0]?.location ?? ""] ?? outLines[0]?.location ?? "",
    toLabel: LOC[inLine?.location ?? ""] ?? inLine?.location ?? "",
    lines: outLines.map((l) => ({
      label: `${l.itemType?.emoji ?? ""} ${l.itemType?.labelMy ?? `#${l.itemTypeId}`}`.trim(),
      qty: l.qty,
    })),
    totalPieces: outLines.reduce((s, l) => s + l.qty, 0),
    delivery: transfer.expenses?.[0]
      ? {
          by:
            transfer.expenses[0].paidToDriver?.name ??
            transfer.expenses[0].paidTo ??
            labels.transfer.driver,
          fee: transfer.expenses[0].amount,
        }
      : null,
    by: transfer.createdBy?.displayName ?? null,
  };

  // Auto-print once when arriving from "Save & Print".
  useEffect(() => {
    if (mounted && !printedRef.current && autoPrint) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [mounted, autoPrint]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <TransferReceipt data={data} shop={shop} />
      </div>

      {transfer.voidedAt && (
        <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
          {labels.salesAdmin.voided}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-2xl border-2 border-emerald-600 py-4 text-lg font-bold text-emerald-700 active:scale-[0.98]"
          >
            🖨 {labels.history.reprint}
          </button>
        </div>
      </div>

      {mounted &&
        createPortal(
          <div id="print-receipt" className="hidden print:block">
            <TransferReceipt data={data} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}
