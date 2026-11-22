import { BadRequestException, Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { getActiveShop, isShopId, SHOP_COOKIE } from "../prisma/shop-context";
import { CreateShopDto, SwitchShopDto } from "./dto/switch-shop.dto";
import { ShopService } from "./shop.service";

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
  constructor(private readonly shops: ShopService) {}

  /** The shop this browser is currently operating in, and every shop there is. */
  @Get()
  current() {
    return { shop: getActiveShop(), shops: this.shops.list() };
  }

  /** Switch this browser to another shop. Available to any signed-in user (staff
   *  included) — the banner keeps the active shop unmistakable. */
  @Post()
  @HttpCode(200)
  switch(@Body() dto: SwitchShopDto, @Res({ passthrough: true }) res: Response) {
    if (!isShopId(dto.shop)) throw new BadRequestException("Unknown shop");
    res.cookie(SHOP_COOKIE, dto.shop, shopCookieOptions());
    return { shop: dto.shop };
  }

  /** Whether this server is able to create shops (admin screen shows it). */
  @Get("create-check")
  @UseGuards(RolesGuard)
  @Roles("admin")
  createCheck() {
    return { ...this.shops.readiness(), source: getActiveShop() };
  }

  /** Create a new shop, optionally pre-filled with people and products from the
   *  current one. Admin only. The browser stays in its current shop. */
  @Post("create")
  @UseGuards(RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateShopDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shops.create(dto, user.sub);
  }
}
