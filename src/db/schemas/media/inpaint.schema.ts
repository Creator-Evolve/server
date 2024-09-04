import {
  IMAGE_GENERATION_MODEL,
  IMAGE_OUTPUT_FORMAT,
} from '@/common/constants/image.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, HydratedDocument } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

export type InpaintDocument = HydratedDocument<Inpaint> &
  mongooseDelete.SoftDeleteDocument;

export enum EDIT_SERVICE {
  REMOVE_BACKGROUD = 'remove_backgroud',
  INPANTING = 'inpanting',
  OUTPAINTING = 'outpainting',
}

@Schema()
export class Inpaint extends Document {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'Image' })
  image_id: string;

  @Prop({ type: String })
  prompt: string;

  @Prop({ type: String })
  optimized_prompt: string;

  @Prop({ type: String })
  negative_prompt: string;

  @Prop({ type: String, enum: EDIT_SERVICE, default: EDIT_SERVICE.INPANTING })
  service: EDIT_SERVICE;

  @Prop({ type: String, enum: IMAGE_OUTPUT_FORMAT })
  output_format: IMAGE_OUTPUT_FORMAT;

  @Prop({ type: String })
  mask_url: string;

  @Prop({ type: String })
  url: string; // this is basically editted image url

  @Prop({ type: String, enum: IMAGE_GENERATION_MODEL })
  engine: IMAGE_GENERATION_MODEL;

  @Prop({ type: Number })
  cost: number;
}

const InpaintSchema = SchemaFactory.createForClass(Inpaint);

InpaintSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});

InpaintSchema.set('toObject', { virtuals: true });
InpaintSchema.set('toJSON', { virtuals: true });

export { InpaintSchema };
