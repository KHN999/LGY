import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser, JwtPayload } from "./jwt-payload";

export interface LoginResult {
  token: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    roles: string[];
    photoUrl: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    // Accounts are canonical in the main schema — auth never follows the active shop.
    const user = await this.prisma.main.user.findUnique({ where: { username } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles,
    };
    const token = await this.jwt.signAsync(payload);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles: user.roles,
        photoUrl: user.photoUrl,
      },
    };
  }

  async getCurrentUser(userId: number) {
    const user = await this.prisma.main.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("User not found or disabled");
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles,
      photoUrl: user.photoUrl,
    };
  }

  verifyToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }

  /**
   * Verify a session token AND re-check the account against the database, so a
   * disabled user (or a changed role) takes effect immediately rather than
   * lingering until the 30-day token expires. Returns fresh identity + roles.
   */
  async validateSession(token: string): Promise<AuthenticatedUser> {
    const payload = this.jwt.verify<JwtPayload>(token);
    const user = await this.prisma.main.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, displayName: true, roles: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("User not found or disabled");
    }
    return {
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles,
    };
  }
}
