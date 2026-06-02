import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

interface SettingsPatch {
  updatedById: number;
  shopName?: string;
  addressLine?: string | null;
  phone?: string | null;
  social?: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
}

const SINGLETON_ID = 1;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The singleton shop-settings row (id = 1), created with defaults on first read.
   *  Hot path (every sell screen + receipt fetches it), so do a plain READ and
   *  only create the row the first time it's missing — upserting on every read
   *  was a write-per-render and measurably slow (~0.7s on the sell screen). */
  async get() {
    const existing = await this.prisma.shopSetting.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.prisma.shopSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto, userId: number) {
    // Trim; empty → null for the optional fields.
    const clean = (v: string | undefined) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t === "" ? null : t;
    };

    const data: SettingsPatch = { updatedById: userId };
    if (dto.shopName !== undefined && dto.shopName.trim() !== "") {
      data.shopName = dto.shopName.trim();
    }
    if (dto.addressLine !== undefined) data.addressLine = clean(dto.addressLine);
    if (dto.phone !== undefined) data.phone = clean(dto.phone);
    if (dto.social !== undefined) data.social = clean(dto.social);
    if (dto.receiptHeader !== undefined) data.receiptHeader = clean(dto.receiptHeader);
    if (dto.receiptFooter !== undefined) data.receiptFooter = clean(dto.receiptFooter);

    return this.prisma.shopSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}
