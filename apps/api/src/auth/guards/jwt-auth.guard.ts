import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth.service";
import type { AuthenticatedUser } from "../jwt-payload";

const COOKIE_NAME = "lgy_session";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    // Web uses the httpOnly cookie; the native app sends `Authorization: Bearer`.
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = req.cookies?.[COOKIE_NAME] || bearer;
    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Not authenticated");
    }
    try {
      // Re-validates against the DB (status + fresh roles), not just the token.
      req.user = await this.auth.validateSession(token);
      return true;
    } catch {
      throw new UnauthorizedException("Session invalid or expired");
    }
  }
}
