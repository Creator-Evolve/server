import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type CreditTransactionDocument = HydratedDocument<CreditTransaction>;

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum FEATURES {
  SHORT_GENERATION = 'short_generation',
  VOICE_CLONING = 'voice_cloning',
  VOICE_DUBBING = 'voice_dubbing',
  VOICE_OVER = 'voice_over',
  VOICE_CHANGER = 'voice_changer',
  RESEARCH_WIZARD = 'research_wizard',
  THUMBNAIL_GENERATOR = 'thumbnail_generator',
  SUBTITLE_GENERATOR = 'subtitle_generator',
}

export enum TransactionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Schema({ timestamps: true })
export class CreditTransaction {
  @Prop({ type: Types.ObjectId, ref: 'CreditAccount' })
  credit_account_id: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user_id: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ type: String, enum: FEATURES })
  feature: FEATURES;

  @Prop({
    type: String,
    required: true,
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Prop({ type: String })
  description: string;
}

export const CreditTransactionSchema =
  SchemaFactory.createForClass(CreditTransaction);
