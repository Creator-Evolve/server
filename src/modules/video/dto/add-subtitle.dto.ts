import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

enum Position {
  TOP = 'top',
  BOTTOM = 'bottom',
}

export class AddSubtitleDto {
  @IsOptional()
  @IsString()
  bg_color?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  font_color?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  font?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  font_size?: string;

  @IsOptional()
  @IsEnum(Position)
  position?: Position;

  @IsOptional()
  @IsBoolean()
  bold: boolean = false;

  @IsOptional()
  @IsBoolean()
  italic: boolean = false;

  @IsOptional()
  @IsNumber()
  outline: number = 0;

  @IsOptional()
  @IsString()
  outline_color: string;
}
