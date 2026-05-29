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

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = req.cookies?.[COOKIE_NAME];
    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Not authenticated");
    }
    try {
      req.user = this.auth.verifyToken(token);
      return true;
    } catch {
      throw new UnauthorizedException("Session invalid or expired");
    }
  }
}
