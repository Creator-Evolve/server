import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { VideoService } from '../services/video.service';
import { UploadVideoDTO } from '../dto/upload-video.dtio';
import { AuthGuard } from '@/common/guards/auth.guard';
import {
  TL_GENERATE_SUMMARY_TYPES,
  TL_GENERATE_TEXT_TYPES,
} from '@/common/constants/tl.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { editFileName } from '../utils/editFileName';
import { Roles } from '@/common/decorators/role.decorator';
import { ROLE } from '@/common/constants/roles.enum';
import { ExtractShortContentDto } from '../dto/extract-short-content.dto';
import { AddSubtitleDto } from '../dto/add-subtitle.dto';

@Controller('media/videos')
@UseGuards(AuthGuard)
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Get('')
  @Roles(ROLE.USER)
  async getVideosList(@Req() req: any, @Query('tl') tl: string) {
    return await this.videoService.getVideosList(req.user.sub, tl === 'true');
  }

  @Get('/:id')
  @Roles(ROLE.USER)
  async getVideosById(@Req() req: any, @Param('id') videoId: string) {
    return await this.videoService.getVideoById(videoId, req.user.access_code);
  }

  @Post('upload')
  @Roles(ROLE.USER)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: './uploads',
        filename: editFileName,
      }),
    }),
  )
  async uploadVideo(
    @Req() req: any,
    @UploadedFile() video: Express.Multer.File,
  ) {
    return this.videoService.uploadVideo(req.user.sub, video);
  }

  @Post('upload/url')
  @Roles(ROLE.USER)
  async uploadVideoUrl(
    @Req() req: any,
    @Query('store') store: string,
    @Body() body: UploadVideoDTO,
  ) {
    return this.videoService.uploadVideoUrl(
      req.user.sub,
      body,
      store === 'true',
    );
  }

  @Post('tl/upload/youtube')
  @Roles(ROLE.USER)
  async uploadYTVideoToTL(@Req() req: any, @Body() body: UploadVideoDTO) {
    return await this.videoService.uploadYTVideoToTL(req.user.sub, body);
  }

  @Post('tl/upload/file')
  @Roles(ROLE.USER)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: './uploads',
        filename: editFileName,
      }),
    }),
  )
  async uploadVideosVideoToTL(
    @Req() req: any,
    @UploadedFile() video: Express.Multer.File,
  ) {
    return await this.videoService.uploadVideosToTL(req.user.sub, video);
  }

  @Get('tl/generate/gist/:id')
  @Roles(ROLE.USER)
  async generateGistFromVideo(
    @Param('id') videoId: string,
    @Query('types') types: string,
  ) {
    const typesArrays = types
      ? (types.split(',') as TL_GENERATE_TEXT_TYPES[])
      : null;

    return await this.videoService.generateGistFromVideo(videoId, typesArrays);
  }

  @Get('tl/generate/text/:id')
  @Roles(ROLE.USER)
  async generateTextFromVideo(
    @Param('id') videoId: string,
    @Query('prompt') prompt: string,
  ) {
    return await this.videoService.generateTextFromVideo(videoId, prompt);
  }

  @Get('tl/generate/summary/:id')
  @Roles(ROLE.USER)
  async generateSummaryFromVideo(
    @Param('id') videoId: string,
    @Query('prompt') prompt: TL_GENERATE_SUMMARY_TYPES,
  ) {
    return await this.videoService.generateSummary(
      videoId,
      decodeURIComponent(prompt) ?? null,
    );
  }

  @Get('tl/generate/chapters/:id')
  @Roles(ROLE.USER)
  async generateChaptersFromVideo(
    @Param('id') videoId: string,
    @Query('prompt') prompt?: string,
  ) {
    return await this.videoService.generateChapters(
      videoId,
      decodeURIComponent(prompt) ?? null,
    );
  }

  @Get('tl/generate/highlights/:id')
  @Roles(ROLE.USER)
  async generateHighlightsFromVideo(
    @Param('id') videoId: string,
    @Query('prompt') prompt: TL_GENERATE_SUMMARY_TYPES,
  ) {
    return await this.videoService.generateHighlights(
      videoId,
      decodeURIComponent(prompt) ?? null,
    );
  }

  @Post('extract/:id')
  @Roles(ROLE.USER)
  async extractShortContent2(
    @Param('id') videoId: string,
    @Body() body: ExtractShortContentDto,
  ) {
    return this.videoService.extractShortContent(videoId, body);
  }

  @Post('add-subtitle/:id')
  @Roles(ROLE.USER)
  async addSubtitleToTheVideo(
    @Param('id') shortId: string,
    @Body() body: AddSubtitleDto,
  ) {
    return this.videoService.addSubtitleToShort(shortId, body);
  }

  @Post('extract/frames/:id')
  async extractFramesFromVideoSegment(
    @Param('id') videoId: string,
    @Body() body: { start: number; end: number },
  ) {
    return this.videoService.extractFramesFromVideoSegment(
      videoId,
      body.start,
      body.end,
    );
  }

  @Get('/:id/shorts')
  async getAllGeneratedShortOfVideo(@Param('id') videoId: string) {
    return this.videoService.getAllGeneratedShortOfVideo(videoId);
  }

  @Post('youtube/upload')
  @Roles(ROLE.USER)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: './uploads',
        filename: editFileName,
      }),
    }),
  )
  async uploadVideoToYoutube(
    @Body() videoDetails: any,
    @Req() req,
    @UploadedFile() video: Express.Multer.File,
  ) {
    return this.videoService.uploadToYoutube(req.user.sub, videoDetails, video);
  }

  @Get('youtube/list')
  @Roles(ROLE.USER)
  async getYoutubeVideosList(@Req() req: any) {
    const userId = req.user.sub;

    return this.videoService.listYoutubeVideos(userId);
  }
}
