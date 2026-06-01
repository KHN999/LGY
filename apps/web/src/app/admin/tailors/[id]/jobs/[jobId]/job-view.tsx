"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InventoryEvent, ItemType, ShopSettings } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Button } from "@/components/ui";
import { TailorJobReceipt, type TailorJobSlip } from "@/components/admin/tailor-job-receipt";

const lineLabel = (l: { itemType?: ItemType; itemTypeId: number }) =>
  `${l.itemType?.emoji ?? ""} ${l.itemType?.labelMy ?? `#${l.itemTypeId}`}`.trim();

export function TailorJobView({
  job,
  tailorName,
  shop,
  autoPrint = false,
}: {
  job: InventoryEvent;
  tailorName: string;
  shop?: ShopSettings;
  autoPrint?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const printedRef = useRef(false);
  useEffect(() => setMounted(true), []);

  const isReceive = job.kind === "TAILOR_RETURN";
  // For a receive, "sent" = pieces that left the tailor: the good ones (this
  // event's OUT@TAILOR) plus the spoiled ones (the linked LOSS event's OUT@TAILOR).
  // Aggregate by item so an input split across the return + its loss shows once.
  const sentMap = new Map<number, { label: string; qty: number }>();
  const addSent = (l: { itemType?: ItemType; itemTypeId: number; qty: number }) => {
    const cur = sentMap.get(l.itemTypeId) ?? { label: lineLabel(l), qty: 0 };
    cur.qty += l.qty;
    sentMap.set(l.itemTypeId, cur);
  };
  if (isReceive) {
    job.lines
      .filter((l) => l.direction === "OUT" && l.location === "TAILOR")
      .forEach(addSent);
    (job.derivedEvents ?? []).forEach((e) =>
      e.lines
        .filter((l) => l.direction === "OUT" && l.location === "TAILOR")
        .forEach(addSent),
    );
  } else {
    job.lines
      .filter((l) => l.direction === "OUT" && l.location === "WAREHOUSE")
      .forEach(addSent);
  }
  const sent = [...sentMap.values()];
  const received = isReceive
    ? job.lines.filter((l) => l.direction === "IN" && l.location === "WAREHOUSE").map((l) => ({ label: lineLabel(l), qty: l.qty }))
    : [];
  const sentTotal = sent.reduce((s, l) => s + l.qty, 0);
  const recvTotal = received.reduce((s, l) => s + l.qty, 0);
  const fee = (job.tailorCharges ?? []).reduce((s, c) => s + c.amount, 0);

  const data: TailorJobSlip = {
    jobId: job.id,
    kind: isReceive ? "TAILOR_RETURN" : "TAILOR_SEND",
    date: job.occurredAt,
    tailorName,
    sent,
    received,
    loss: Math.max(0, sentTotal - recvTotal),
    fee,
    by: job.createdBy?.displayName ?? null,
  };

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
        <TailorJobReceipt data={data} shop={shop} />
      </div>

      {job.voidedAt && (
        <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
          {labels.salesAdmin.voided}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => window.print()}
        className="self-start border-2 border-emerald-600 text-emerald-700"
      >
        🖨 {labels.history.reprint}
      </Button>

      {mounted &&
        createPortal(
          <div id="print-receipt" className="hidden print:block">
            <TailorJobReceipt data={data} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}
