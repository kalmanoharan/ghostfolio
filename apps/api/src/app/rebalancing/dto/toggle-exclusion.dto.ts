import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleExclusionDto {
  @IsString()
  symbolProfileId: string;

  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsBoolean()
  excludeFromCalculation?: boolean;

  @IsOptional()
  @IsBoolean()
  neverSell?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

