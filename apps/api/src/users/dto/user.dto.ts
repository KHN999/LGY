import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const USER_ROLES = ["admin", "staff"] as const;
export type UserRoleInput = (typeof USER_ROLES)[number];

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsIn(USER_ROLES)
  role!: UserRoleInput;

  @IsString()
  @MinLength(4)
  @MaxLength(100)
  password!: string;
}

/** Username is immutable (it's the login identity); only these can change. */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRoleInput;

  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED"])
  status?: "ACTIVE" | "DISABLED";
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  password!: string;
}
