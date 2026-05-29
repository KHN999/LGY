import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Marks an endpoint as requiring at least one of the given roles.
 * Use together with JwtAuthGuard + RolesGuard.
 *
 * @example
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 *   @Get('users')
 *   listUsers() {}
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
