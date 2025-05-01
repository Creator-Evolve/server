import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { VideoMetaData } from './video.schema';

// Define type for subtitle style (e.g., font, size, color)
export interface VideoSubtitleOptions {
  font: string; // e.g., Arial, Roboto
  font_size: number; // e.g., 24px
  font_color: string; // e.g., #ffffff
  background_color: string; // e.g., transparent or #000000
  text_align: 'left' | 'center' | 'right'; // subtitle alignment
  position: {
    x: number; // Custom x-coordinate
    y: number; // Custom y-coordinate
  };
  bold: boolean;
  italic: boolean;
  underline: boolean;
  outline_color?: string;
  shadow_color?: string;
  outline?: number;
}

export type SubtitleTemplateDocument = HydratedDocument<SubtitleTemplate>;

@Schema()
export class SubtitleTemplate extends Document {
  @Prop({ type: String, required: true })
  template_name: string; // Name of the template

  @Prop({ type: Object, required: true })
  options: VideoSubtitleOptions; // Style options for the subtitle

  @Prop({ type: String, required: true })
  sample_video_url: string; // sample video of the template

  @Prop({
    type: {
      width: Number,
      height: Number,
    },
    required: true,
  })
  sample_video_metadata: VideoMetaData; // sample video of the template

  @Prop({ type: Date, default: Date.now })
  created_at: Date; // Timestamp of when the template was created

  @Prop({ type: Date, default: Date.now })
  updated_at: Date; // Timestamp for when it was last updated

  @Prop({
    type: [
      {
        type: MongooseSchema.Types.ObjectId,
        ref: 'VideoSubtitle',
      },
    ],
  })
  subtitles: MongooseSchema.Types.ObjectId[];
}

export const SubtitleTemplateSchema =
  SchemaFactory.createForClass(SubtitleTemplate);
