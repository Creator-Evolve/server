import { CreditAccountDocument } from '@/db/schemas/users/credit/credit.schema';
import { Expose, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { isObjectIdOrHexString } from 'mongoose';

export class UserResponseDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  id: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @Expose()
  email: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  @Expose()
  phone: string;

  @IsNumber()
  @IsNotEmpty()
  @Expose()
  credit_account_id: string;

  @IsObject()
  @IsNotEmpty()
  @Expose()
  credit_account: CreditAccountDocument;

  @IsBoolean()
  @IsNotEmpty()
  @Expose()
  is_verified: boolean;

  @IsString()
  @IsNotEmpty()
  @Expose()
  access_token: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  refresh_token: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  is_google_authenticated: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  is_youtube_authenticated: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  roles: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  access_code: string;
}
