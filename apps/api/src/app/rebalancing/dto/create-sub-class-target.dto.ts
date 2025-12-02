import { AssetSubClass } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export class CreateSubClassTargetDto {
  @IsEnum(AssetSubClass)
  assetSubClass: AssetSubClass;

  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercent: number;
}

