import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { AuthenticatedUser } from "./jwt-payload";
import { SHOP_COOKIE } from "../prisma/shop-context";

const COOKIE_NAME = "lgy_session";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.login(dto.username, dto.password);
    res.cookie(COOKIE_NAME, token, this.cookieOptions());
    // Always start a fresh session in the real shop — never inherit a leftover
    // "playground" selection from a previous user of this browser.
    res.cookie(SHOP_COOKIE, "main", this.cookieOptions());
    // Cookie for the web; token in the body for the native app (no cookies).
    return { user, token };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) res: Response) {
    // clearCookie must match the set attributes (path/secure/sameSite) but NOT
    // maxAge — Express 5 ignores it and warns; it expires the cookie itself.
    res.clearCookie(COOKIE_NAME, this.baseCookieOptions());
    res.clearCookie(SHOP_COOKIE, this.baseCookieOptions());
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { user: await this.auth.getCurrentUser(user.sub) };
  }

  /** Attributes shared by set + clear (clear must match these to remove the cookie). */
  private baseCookieOptions() {
    const isProd = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
    };
  }

  private cookieOptions() {
    return { ...this.baseCookieOptions(), maxAge: COOKIE_MAX_AGE_MS };
  }
}
