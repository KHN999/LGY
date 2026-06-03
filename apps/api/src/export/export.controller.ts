import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ExportService, type Statement } from "./export.service";

/** Default period = this calendar month (UTC) when from/to aren't supplied. */
function range(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: from || first.toISOString().slice(0, 10),
    to: to || now.toISOString().slice(0, 10),
  };
}

@Controller("export")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ExportController {
  constructor(private readonly service: ExportService) {}

  /** JSON used by the print-styled statement page. */
  @Get("statement")
  statement(@Query("from") from?: string, @Query("to") to?: string): Promise<Statement> {
    const r = range(from, to);
    return this.service.statement(r.from, r.to);
  }

  /** Bank-statement cash ledger as a downloadable CSV (UTF-8 BOM for Excel). */
  @Get("statement.csv")
  async statementCsv(@Res() res: Response, @Query("from") from?: string, @Query("to") to?: string): Promise<void> {
    const r = range(from, to);
    const s = await this.service.statement(r.from, r.to);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="lgy-statement-${s.from}_to_${s.to}.csv"`);
    res.send(String.fromCharCode(0xfeff) + this.service.statementCsv(s));
  }

  /** Full data dump (every table) as a downloadable JSON backup. */
  @Get("backup.json")
  async backup(@Res() res: Response): Promise<void> {
    const data = await this.service.backup();
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="lgy-backup-${day}.json"`);
    res.send(JSON.stringify({ exportedAt: now.toISOString(), data }, null, 2));
  }
}
