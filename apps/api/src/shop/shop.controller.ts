import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { getActiveShop, SHOP_COOKIE, SHOP_IDS } from "../prisma/shop-context";
import { SwitchShopDto } from "./dto/switch-shop.dto";

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function shopCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

@Controller("shop")
@UseGuards(JwtAuthGuard)
export class ShopController {
  /** The shop this browser is currently operating in. */
  @Get()
  current() {
    return { shop: getActiveShop(), shops: SHOP_IDS };
  }

  /** Switch this browser between the real shop and the playground. Available to
   *  any signed-in user (staff included) — the playground is a safe sandbox, and
   *  staff need it for practice; the loud banner keeps it unmistakable. */
  @Post()
  @HttpCode(200)
  switch(@Body() dto: SwitchShopDto, @Res({ passthrough: true }) res: Response) {
    res.cookie(SHOP_COOKIE, dto.shop, shopCookieOptions());
    return { shop: dto.shop };
  }
}
