import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto, UserRoleInput } from "./dto/user.dto";

export interface UserRow {
  id: number;
  username: string;
  displayName: string;
  roles: string[];
  status: "ACTIVE" | "DISABLED";
  photoUrl: string | null;
  createdAt: Date;
}

const SELECT = {
  id: true,
  username: true,
  displayName: true,
  roles: true,
  status: true,
  photoUrl: true,
  createdAt: true,
} as const;

/** Admins can do everything incl. operate the POS; staff are POS-only. */
function rolesFor(role: UserRoleInput): string[] {
  return role === "admin" ? ["admin", "staff"] : ["staff"];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Accounts are canonical in the main schema — never shop-scoped.
  private get db() {
    return this.prisma.main;
  }

  async list(): Promise<UserRow[]> {
    return this.db.user.findMany({
      orderBy: [{ status: "asc" }, { username: "asc" }],
      select: SELECT,
    });
  }

  async create(dto: CreateUserDto): Promise<UserRow> {
    const username = dto.username.trim();
    const existing = await this.db.user.findUnique({ where: { username } });
    if (existing) throw new ConflictException(`Username "${username}" is already taken`);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.user.create({
      data: {
        username,
        displayName: dto.displayName.trim(),
        roles: rolesFor(dto.role),
        passwordHash,
        status: "ACTIVE",
      },
      select: SELECT,
    });
  }

  async update(id: number, dto: UpdateUserDto, actingUserId: number): Promise<UserRow> {
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const willBeAdmin =
      dto.role !== undefined ? dto.role === "admin" : user.roles.includes("admin");
    const willBeActive =
      dto.status !== undefined ? dto.status === "ACTIVE" : user.status === "ACTIVE";

    // You can't disable or demote your own account — that's a self-lockout.
    if (id === actingUserId && (!willBeActive || !willBeAdmin)) {
      throw new BadRequestException("You can't disable or demote your own account");
    }

    // The system must always keep at least one active admin.
    const losingAnAdmin =
      user.roles.includes("admin") && user.status === "ACTIVE" && !(willBeAdmin && willBeActive);
    if (losingAnAdmin) {
      const otherActiveAdmins = await this.db.user.count({
        where: { id: { not: id }, status: "ACTIVE", roles: { has: "admin" } },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException("There must be at least one active admin");
      }
    }

    return this.db.user.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.role !== undefined ? { roles: rolesFor(dto.role) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: SELECT,
    });
  }

  async resetPassword(id: number, password: string): Promise<{ ok: true }> {
    const user = await this.db.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }
}
