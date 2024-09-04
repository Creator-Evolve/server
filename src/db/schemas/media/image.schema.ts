import {
  IMAGE_ASPECT_RATIO,
  IMAGE_GENERATION_MODEL,
  IMAGE_OUTPUT_FORMAT,
  IMAGE_QUALITY,
  IMAGE_SIZE,
  IMAGE_STYLE,
  IMAGE_TYPE,
} from '@/common/constants/image.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, HydratedDocument } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

export type ImageDocument = HydratedDocument<Image> &
  mongooseDelete.SoftDeleteDocument;

@Schema()
export class Image extends Document {
  @Prop({ type: String, enum: IMAGE_GENERATION_MODEL })
  engine: IMAGE_GENERATION_MODEL;

  @Prop({ type: String })
  prompt: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String, enum: IMAGE_TYPE })
  type: IMAGE_TYPE;

  @Prop({ type: String })
  negative_prompt: string;

  @Prop({ type: String, enum: IMAGE_SIZE })
  size: IMAGE_SIZE;

  @Prop({ type: String, enum: IMAGE_OUTPUT_FORMAT })
  output_format: IMAGE_OUTPUT_FORMAT;

  @Prop({ type: String, enum: IMAGE_ASPECT_RATIO })
  aspect: IMAGE_ASPECT_RATIO;

  @Prop({ type: String, enum: IMAGE_STYLE })
  style: IMAGE_STYLE;

  @Prop({ type: String })
  url: string;

  @Prop({ type: String, enum: IMAGE_QUALITY })
  quality: IMAGE_QUALITY;

  @Prop({ type: Number })
  cost: number;

  @Prop({ type: [{ type: mongoose.Types.ObjectId, ref: 'Inpaint' }] })
  inpaints: [];

  @Prop({ type: [], default: [] })
  edits: {
    url: string;
  }[];

  @Prop({ type: mongoose.Types.ObjectId, ref: 'User' })
  user_id: mongoose.Types.ObjectId;
}

const ImageSchema = SchemaFactory.createForClass(Image);

ImageSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });

ImageSchema.set('toObject', { virtuals: true });
ImageSchema.set('toJSON', { virtuals: true });

export { ImageSchema };
