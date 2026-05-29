import { IsString, MinLength, MaxLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(100)
  password!: string;
}
