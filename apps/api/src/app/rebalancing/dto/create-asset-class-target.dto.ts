import { AssetClass } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export class CreateAssetClassTargetDto {
  @IsEnum(AssetClass)
  assetClass: AssetClass;

  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercent: number;
}

