import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { toYangonYmd, ymdToYangonStart } from "./yangon-time";

/**
 * Backdating guard. A backdated write (one that carries an explicit date) must
 * not land on a day that has ALREADY been closed — that day's drawer was
 * reconciled and its numbers are frozen, so injecting a transaction would make
 * the close wrong. We check the EXACT day, not "before the latest close": a day
 * that was never closed (even one earlier than a later close) is fair game,
 * since its own close hasn't happened yet and will include the entry.
 *
 * Live writes (no explicit date → "now") skip this. Uses the shop-scoped
 * client, so each shop's own close history governs its writes.
 */
export async function assertDateNotClosed(
  prisma: PrismaService,
  date: Date | null | undefined,
): Promise<void> {
  if (!date) return;
  const writeDay = toYangonYmd(date);
  const closed = await prisma.dailyClose.findUnique({
    where: { closeDate: ymdToYangonStart(writeDay) },
    select: { id: true },
  });
  if (closed) {
    throw new BadRequestException(
      `${writeDay} is already closed. Reopen (delete) that day's close to record on it.`,
    );
  }
}
