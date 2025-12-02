import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStrategyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  driftThreshold?: number;
}

