import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SwitchShopDto {
  /** A shop key from the registry (validated against it in the controller). */
  @IsString()
  @MaxLength(40)
  shop!: string;
}

/** Create a new, empty shop and choose which master data to carry into it from
 *  the shop you are currently in. Transactions, stock and debts are never copied. */
export class CreateShopDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional() @IsBoolean() itemTypes?: boolean;
  @IsOptional() @IsBoolean() customers?: boolean;
  @IsOptional() @IsBoolean() suppliers?: boolean;
  @IsOptional() @IsBoolean() tailors?: boolean;
  @IsOptional() @IsBoolean() drivers?: boolean;
  @IsOptional() @IsBoolean() employees?: boolean;
  @IsOptional() @IsBoolean() settings?: boolean;
}
