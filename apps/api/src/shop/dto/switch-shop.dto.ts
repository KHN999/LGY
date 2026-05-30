import { IsIn } from "class-validator";
import { SHOP_IDS, type ShopId } from "../../prisma/shop-context";

export class SwitchShopDto {
  @IsIn(SHOP_IDS)
  shop!: ShopId;
}
