import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { VideoMetaData } from './video.schema';

export interface IVideoShorts {}

export type VideoShortDocument = HydratedDocument<VideoShort>;

export interface IShortSegment {
  start: string;
  end: string;
  context: string;
  duration: number;
}

@Schema()
export class VideoShort extends Document {
  @Prop({ type: String })
  title: string;

  @Prop({ type: String })
  url: string;

  @Prop({ type: String })
  thumbnail: string;

  @Prop({ type: String })
  captionated_url: string; // captionated video

  @Prop({ type: String })
  start: string;

  @Prop({ type: String })
  end: string;

  // for contextual merge
  @Prop({ type: [{}] })
  segments: IShortSegment[];

  @Prop({ type: String })
  summary: string;

  @Prop({ type: Object })
  metadata: VideoMetaData;

  @Prop({ type: String })
  srt: string;

  @Prop({ type: Types.ObjectId, ref: 'Video' })
  video_id: Types.ObjectId;
}

export const VideoShortSchema = SchemaFactory.createForClass(VideoShort);
