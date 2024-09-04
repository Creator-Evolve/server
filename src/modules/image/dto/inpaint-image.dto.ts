import {
  IMAGE_GENERATION_MODEL,
  IMAGE_OUTPUT_FORMAT,
  IMAGE_SIZE,
} from '@/common/constants/image.enum';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class InpaintImageDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsNotEmpty()
  mask_url: string;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  enable_prompt_optimization: boolean = false;

  @IsString()
  @IsNotEmpty()
  image_url: string;

  @IsString()
  @IsOptional()
  negative_prompt: string;

  @IsString()
  @IsOptional()
  size: IMAGE_SIZE; // image size of the dall-e

  @IsString()
  @IsNotEmpty()
  @IsEnum(IMAGE_GENERATION_MODEL)
  model: IMAGE_GENERATION_MODEL;

  @ValidateIf((o) => o.model !== IMAGE_GENERATION_MODEL.DALLE)
  @IsString()
  @IsNotEmpty()
  @IsEnum(IMAGE_OUTPUT_FORMAT)
  output_format: IMAGE_OUTPUT_FORMAT;
}
