import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type VoiceChangeDocument = HydratedDocument<VoiceChange>;

export enum VOICE_MODEL {
  ELEVEN_LABS = 'elevenlabs',
}

@Schema()
export class VoiceChange extends Document {
  @Prop({ type: String })
  name: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  user_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: String })
  url: string; // Original audio URL

  @Prop({ type: String, enum: VOICE_MODEL, default: VOICE_MODEL.ELEVEN_LABS })
  engine: VOICE_MODEL;

  @Prop({ type: String })
  el_voice_id: string;

  @Prop({ type: String })
  changed_voice_url: string;

  @Prop({ type: Date, default: Date.now() })
  created_at: Date;

  @Prop({ type: Date, default: Date.now() })
  updated_at: Date;
}

export const VoiceChangeSchema = SchemaFactory.createForClass(VoiceChange);
