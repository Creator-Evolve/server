import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ExtractShortContentDto {
  @IsNotEmpty()
  @IsNumber()
  aspect: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  prompt: string;

  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  total: number = 3; // total Number of videos to generate

  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  @Max(60)
  @Min(10)
  duration: number = 60; // total Number of videos to generate

  @IsOptional()
  @IsNotEmpty()
  @IsBoolean()
  allow_contextual_merging: boolean = false;
}
