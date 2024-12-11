import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Model,
} from 'mongoose';
import { FEATURES } from './credit.transaction.schema';

export type CreditPackageDocument = HydratedDocument<CreditPackage>;

@Schema({ timestamps: true })
export class CreditPackage extends Document {
  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, required: true })
  credits: number;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({
    type: [
      {
        type: String,
        enum: FEATURES,
      },
    ],
  })
  features: FEATURES[];

  @Prop({ type: Boolean, default: true })
  is_active: boolean;
}

export const CreditPackageSchema = SchemaFactory.createForClass(CreditPackage);