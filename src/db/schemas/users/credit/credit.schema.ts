import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Model,
} from 'mongoose';

export type CreditAccountDocument = HydratedDocument<CreditAccount>;

@Schema({ timestamps: true })
export class CreditAccount extends Document {
  @Prop({ type: Number, required: true, default: 0 })
  balance: number;

  @Prop({ type: String, required: true, unique: true })
  account_id: string; // unique account id

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: 'User' })
  user_id: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'CreditTransaction' }],
  })
  transactions: MongooseSchema.Types.ObjectId[];

  @Prop({
    type: {
      package_id: {
        type: MongooseSchema.Types.ObjectId,
        ref: 'CreditPackage',
      },
      purchased_at: {
        type: Date,
        default: Date.now(),
      },
    },
  })
  package_history: {
    package_id: MongooseSchema.Types.ObjectId;
    purchased_at: Date;
  }[];
}

export const CreditAccountSchema = SchemaFactory.createForClass(CreditAccount);
