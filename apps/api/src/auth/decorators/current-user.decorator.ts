import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import type { AuthenticatedUser } from "../jwt-payload";

/**
 * Inject the authenticated user into a controller method.
 * Requires JwtAuthGuard to have populated req.user.
 *
 * @example
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) {}
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new Error("CurrentUser decorator used without JwtAuthGuard");
    }
    return req.user;
  },
);
