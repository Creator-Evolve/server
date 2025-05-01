import { ClaudeService } from '@/libs/claude/services/claude.service';
import {
  OpenAIService,
  TRANSCRIPTION_RESPONSE_FORMAT,
} from '@/libs/openai/services/openai.service';
import { Injectable } from '@nestjs/common';
import { VideoProcessorService } from '../processor/video.processor';
import { StorageService } from '@/common/storage/services/storage.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import { UserService } from '@/modules/user/services/user.service';
import { Video } from '@/db/schemas/media/video.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { VideoShort } from '@/db/schemas/media/short.schema';
import { VideoSubtitleOptions } from '@/db/schemas/media/subtitle-template.schema';
import { extractExtension } from 'utils';

import { v4 as uuid } from 'uuid';
import {
  convertHexToV4StyleColor,
  generateV4Style,
  V4StyleColorEnum,
} from 'utils/v4Style';

@Injectable()
export class SubtileService {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<Video>,
    @InjectModel(VideoShort.name) private videoShortModel: Model<VideoShort>,
    private readonly userService: UserService,
    private readonly loggerService: LoggerService,
    private readonly storageService: StorageService,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly openAIService: OpenAIService,
    private readonly claudeService: ClaudeService,
  ) {}

  async createTemplate(
    videoUrl: string,
    name: string,
    options: VideoSubtitleOptions,
  ) {
    try {
      const {
        background_color,
        bold,
        font,
        font_color,
        font_size,
        italic,
        position,
        text_align,
        underline,
        outline_color,
        shadow_color,
        outline,
      } = options;

      const extention = extractExtension(videoUrl);
      const videoPath = await this.storageService.downloadVideo(
        videoUrl,
        `${uuid}.${extention}`,
      );
      const transciption = await this.openAIService.transcribe({
        filePath: videoPath,
        response_format: TRANSCRIPTION_RESPONSE_FORMAT.SRT,
      });

      const { height, width } =
        await this.videoProcessorService.getVideoDimension(videoPath);

      const v4Style = generateV4Style({
        posX: position.x,
        posY: position.y,
        underline,
        fontName: font,
        fontSize: font_size,
        primaryColor: convertHexToV4StyleColor(font_color) as V4StyleColorEnum,
        bgColor: background_color,
        borderStyle: background_color ? 4 : 0,
        bold: bold || false,
        italic: italic || false,
        outline: outline || 0,
        outlineColor: outline
          ? (convertHexToV4StyleColor(outline_color) as V4StyleColorEnum)
          : V4StyleColorEnum.Transparent,
      });
    } catch (error) {}
  }
}
