import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { VideoSubtitleOptions } from './subtitle-template.schema';

export type VideoSubtitleDocument = HydratedDocument<VideoSubtitle>;


// subtitle style mode can be custom i.e custom options or template i.e options from template
export enum VIDEO_SUBTITLE_MODE{
  CUSTOM="custom",
  TEMPLATE=""
}

@Schema()
export class VideoSubtitle extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Video', required: true })
  video_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  subtitle_text: string;

  @Prop({ type: Object, required: true })
  options: VideoSubtitleOptions;

  @Prop({ type: String })
  subtitle_url: string; // URL for the subtitle file, if stored externally

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SubtitleTemplate' })
  template_id?: MongooseSchema.Types.ObjectId;

  @Prop({ type: String })
  style_mode?: 'custom' | 'template';

  @Prop({ type: Date, default: Date.now() })
  created_at: Date;

  @Prop({ type: Date, default: Date.now() })
  updated_at: Date;
}

export const VideoSubtitleSchema = SchemaFactory.createForClass(VideoSubtitle);
