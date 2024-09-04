import { responseGenerator } from '@/common/config/helper/response.helper';
import {
  TL_DEFAULT_NAME,
  TL_GENERATE_TEXT_TYPES,
} from '@/common/constants/tl.enum';
import {
  CHAPTER_CUSTOM_PROMPT,
  IContextualVideoSegment,
  IFormattedDataResponse,
  VIDEO_TYPES,
} from '@/common/constants/video.enum';
import { LoggerService } from '@/common/logger/services/logger.service';
import { UserService } from '@/modules/user/services/user.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from '@/db/schemas/media/video.schema';
import { TwelveLabsService } from '@/libs/twelvelabs/services/twelvelabs.service';
import { Model, ObjectId } from 'mongoose';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { UploadVideoDTO } from '../dto/upload-video.dtio';
import { createReadStream, readFileSync } from 'fs';
import { StorageService } from '@/common/storage/services/storage.service';

import {
  IExtractedShortFormContentResponse,
  ISegmentCrop,
  VideoProcessorService,
} from './processor.service';
import {
  CHAT_COMPLETION_RESPONSE_FORMAT,
  OPEN_AI_CHAT_COMPLETION_MODEL,
  OpenAIService,
  TRANSCRIPTION_RESPONSE_FORMAT,
} from '@/libs/openai/services/openai.service';

import { auth } from 'googleapis/build/src/apis/oauth2';
import { youtube as _youtube } from 'googleapis/build/src/apis/youtube';
import {
  analyzeShortFormContentInTheVideo,
  generateContextualShortFormContent,
} from '@/common/prompt';

import * as mime from 'mime-types';

import { v4 as uuid } from 'uuid';
import { extractExtension } from 'utils';
import { ClaudeService } from '@/libs/claude/services/claude.service';
import { VideoShort } from '@/db/schemas/media/short.schema';
import { ExtractShortContentDto } from '../dto/extract-short-content.dto';
import { AddSubtitleDto } from '../dto/add-subtitle.dto';
import {
  convertHexToV4StyleColor,
  generateV4Style,
  V4StyleColorEnum,
} from 'utils/v4Style';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<Video>,
    @InjectModel(VideoShort.name) private videoShortModel: Model<VideoShort>,
    private readonly twelveLabsService: TwelveLabsService,
    private readonly userService: UserService,
    private readonly loggerService: LoggerService,
    private readonly storageService: StorageService,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly openAIService: OpenAIService,
    private readonly claudeService: ClaudeService,
  ) {}

  async getVideosList(userId: string, tl: boolean) {
    const videos = await this.userService.getVideosList(userId, tl);

    const videosWithPresignedUrl = videos.map((video) => {
      if (video.type === VIDEO_TYPES.YOUTUBE) return video;
      const preSignedThumbnailUrl = this.storageService.get(video.thumbnail);
      const preSignedVideoUrl = this.storageService.get(video.url);

      return {
        ...video,
        url: preSignedVideoUrl,
        thumbnail: preSignedThumbnailUrl,
      };
    });

    return responseGenerator('Videos Fetched', videosWithPresignedUrl);
  }

  async getVideoById(videoId: string, accessCode: number): Promise<Video> {
    const video = await this.videoModel
      .findById(videoId)
      .populate({ path: 'user_id', select: 'access_code' })
      .lean();

    const hasAccess = await this.userService.verifyUserAccessCode(
      video.user_id,
      accessCode,
    );

    if (!hasAccess)
      throw new HttpException('Unauthorized Access', HttpStatus.UNAUTHORIZED);

    if (!video)
      throw new HttpException(
        'No video found with this id',
        HttpStatus.NOT_FOUND,
      );

    const videoUrl =
      video.type === VIDEO_TYPES.FILE_UPLOAD
        ? this.storageService.get(video.url)
        : video.url;

    return { ...video, url: videoUrl };
  }

  async uploadVideo(userId: string, video: Express.Multer.File) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideo: Start',
          data: { userId, video: video.originalname },
        }),
      );

      const videoPath = join(
        __dirname,
        '..',
        '..',
        '../..',
        'uploads',
        video.filename,
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideo: Video Path',
          data: videoPath,
        }),
      );

      const fileBuffer = readFileSync(videoPath);

      const s3ImageFilePath =
        await this.videoProcessorService.extractThumbnail(videoPath);

      // Saving video in s3
      const s3FilePath = await this.storageService.upload(
        fileBuffer,
        video.originalname,
        video.mimetype,
      );

      await unlink(videoPath);

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideo: Video uploaded to S3',
          data: s3FilePath,
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideo: Thumbnail extracted',
          data: s3ImageFilePath,
        }),
      );

      const videoDoc = new this.videoModel({
        user_id: userId,
        type: VIDEO_TYPES.FILE_UPLOAD,
        name: video?.originalname || '',
        url: s3FilePath,
        thumbnail: s3ImageFilePath,
      });

      const savedVideo = await videoDoc.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideo: Video document saved in DB',
          data: savedVideo,
        }),
      );

      const user = await this.userService.saveVideo(
        userId,
        videoDoc._id as string,
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideo: Video linked to user',
          data: user,
        }),
      );

      const s3ViewUrl = this.storageService.get(videoDoc.url);
      const s3ThumbnailUrl = this.storageService.get(videoDoc.thumbnail);

      return responseGenerator('Video uploaded', {
        ...videoDoc.toObject(),
        url: s3ViewUrl,
        thumbnail: s3ThumbnailUrl,
      });
    } catch (error) {
      this.loggerService.error(
        JSON.stringify({
          message: 'uploadVideo: Error occurred',
          error,
        }),
      );
      throw new HttpException('Error occurred', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async uploadVideoUrl(userId: string, body: UploadVideoDTO) {
    const { url } = body;
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideoUrl: Start',
          data: url,
        }),
      );

      const video = new this.videoModel({
        user_id: userId,
        type: VIDEO_TYPES.YOUTUBE,
        thumbnail: body.thumbnail,
        name: body.name,
        url,
      });

      await video.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideoUrl: Video document saved in DB',
          data: video,
        }),
      );

      const user = await this.userService.saveVideo(
        userId,
        video._id as string,
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadVideoUrl: Video linked to user',
          data: user,
        }),
      );

      return responseGenerator('Video uploaded', video.toObject());
    } catch (error) {
      this.loggerService.error(
        JSON.stringify({
          message: 'uploadVideoUrl: Error occurred',
          error,
        }),
      );
      throw new HttpException('Error occurred', HttpStatus.BAD_GATEWAY);
    }
  }

  async uploadYTVideoToTL(userId: string, body: UploadVideoDTO) {
    const { url } = body;
    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Retrieving TL Index from DB - Start ------------',
          data: TL_DEFAULT_NAME.YOUTUBE_VIDEOS,
        }),
      );

      const tlIndex = await this.twelveLabsService.findIndexByName(
        TL_DEFAULT_NAME.YOUTUBE_VIDEOS,
      );

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Retrieving TL Index from DB - Finished ------------',
          data: tlIndex,
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Uploading Video to TL Index - Start ------------',
          data: url,
        }),
      );

      const taskId = await this.twelveLabsService.uploadYTVideoTask(
        tlIndex,
        url,
      );

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Uploading Video to TL Index - Finished ------------',
          data: { taskId },
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Saving video detail in db - Start ------------',
          data: { taskId, url, userId },
        }),
      );

      const video = new this.videoModel({
        tl_task_id: taskId,
        user_id: userId,
        type: VIDEO_TYPES.YOUTUBE,
        thumbnail: body.thumbnail,
        name: body.name,
        url,
      });

      await video.save();

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Saving video detail in db - Finished ------------',
        }),
      );

      const user = await this.userService.saveVideo(
        userId,
        video._id as string,
      );

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadYTVideoToTL: ---------- Saving video detail in user db - Finished ------------',
          data: user,
        }),
      );

      return responseGenerator('Video uploaded', { taskId });
    } catch (error) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error Occured',
          error,
        }),
      );
      throw new HttpException('Error occured', HttpStatus.BAD_GATEWAY);
    }
  }

  async uploadVideosToTL(userId: string, video: Express.Multer.File) {
    this.loggerService.log(
      JSON.stringify({
        message: 'uploadVideosToTL: ---------- Start ------------',
        data: { userId, video: video.originalname },
      }),
    );

    const tlIndex = await this.twelveLabsService.findIndexByName(
      TL_DEFAULT_NAME.YOUTUBE_VIDEOS,
    );

    this.loggerService.log(
      JSON.stringify({
        message: 'uploadVideosToTL: ---------- TL Index Retrieved ------------',
        data: tlIndex,
      }),
    );

    const videoPath = join(
      __dirname,
      '..',
      '..',
      '../..',
      'uploads',
      video.filename,
    );

    this.loggerService.log(
      JSON.stringify({
        message: 'uploadVideosToTL: ---------- Video Path ------------',
        data: videoPath,
      }),
    );

    const taskIds = await this.twelveLabsService.uploadVideosTask(
      tlIndex,
      [videoPath], // Pass as an array
    );

    const fileBuffer = readFileSync(videoPath);

    // Saving video in s3
    const s3FilePath = await this.storageService.upload(
      fileBuffer,
      video.originalname,
      video.mimetype,
    );

    const s3ImageFilePath =
      await this.videoProcessorService.extractThumbnail(videoPath);

    this.loggerService.log(
      JSON.stringify({
        message: 'uploadVideosToTL: ---------- Video Uploaded ------------',
        data: taskIds,
      }),
    );

    for (const taskId of taskIds) {
      const videoDoc = new this.videoModel({
        tl_task_id: taskId,
        user_id: userId,
        type: VIDEO_TYPES.FILE_UPLOAD,
        name: video?.originalname || '',
        url: s3FilePath,
        thumbnail: s3ImageFilePath,
      });

      await videoDoc.save();

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadVideosToTL: ---------- Video Saved to DB ------------',
          data: { taskId, videoId: videoDoc._id },
        }),
      );

      await this.userService.saveVideo(userId, videoDoc._id as string);

      await unlink(videoPath);

      this.loggerService.log(
        JSON.stringify({
          message:
            'uploadVideosToTL: ---------- Video Linked to User ------------',
          data: { userId, videoId: videoDoc._id },
        }),
      );
    }

    return responseGenerator('Video Uploaded', { taskIds });
  }

  async generateGistFromVideo(
    videoId: string,
    types: TL_GENERATE_TEXT_TYPES[],
  ) {
    this.loggerService.log(
      JSON.stringify({
        message:
          'generateGistFromVideo: ---------- Calling TLService - Start ------------',
        data: { videoId, types },
      }),
    );

    const data = await this.twelveLabsService.generateGistFromVideo(
      videoId,
      types,
    );

    this.loggerService.log(
      JSON.stringify({
        message:
          'generateGistFromVideo: ---------- Calling TLService - Completed ------------',
        data,
      }),
    );

    return responseGenerator('Generated', data);
  }

  async generateTextFromVideo(
    videoId: string,
    prompt?: string,
  ): Promise<IFormattedDataResponse> {
    this.loggerService.log(
      JSON.stringify({
        message:
          'generateTextFromVideo: ---------- Calling TLService - Start ------------',
        data: { videoId, prompt },
      }),
    );

    const customPrompt = prompt ?? CHAPTER_CUSTOM_PROMPT;

    const data = await this.twelveLabsService.generateTextFromVideo(
      videoId,
      customPrompt,
    );

    this.loggerService.log(
      JSON.stringify({
        message:
          'generateTextFromVideo: ---------- Calling TLService - Completed ------------',
        data,
      }),
    );

    const customGPTPrompt = `
      TEXT: ${data.data}

      TASK: Your Task is to extract data in proper json format in the below schema
        
      SCHEMA:
        segments: [
          {
            title:".....",
            start:0, // video start time, it should always be in seconds
            end:30 // video end time, it should always be in seconds,
            summary:"..." 
          }
        ]

      CONTEXT: This response is generated from a video understanding service which provided me the response for the below EXTERNAL_VIDEO_SERVICE_PROMPT

      EXTERNAL_VIDEO_SERVICE_PROMPT: 
        ${CHAPTER_CUSTOM_PROMPT}
    `;

    this.loggerService.log(
      JSON.stringify({
        message:
          'generateTextFromVideo: ---------- Calling Open AI Chat completion  - Started ------------',
      }),
    );

    const response = await this.openAIService.chatCompletion({
      prompt: customGPTPrompt,
      responseFormat: CHAT_COMPLETION_RESPONSE_FORMAT.JSON_OBJECT,
      temperature: 0.1,
    });

    this.loggerService.log(
      JSON.stringify({
        message:
          'generateTextFromVideo: ---------- Calling Open AI Chat completion  - Completed ------------',
        data: response,
      }),
    );

    const parsedResponse: IFormattedDataResponse = JSON.parse(response);

    return parsedResponse;
  }

  async generateSummary(videoId: string, prompt?: string) {
    this.loggerService.log(
      JSON.stringify({
        message:
          'generateSummaryFromVideo[1]: ---------- Calling TLService - Start ------------',
        data: { videoId, prompt },
      }),
    );

    const data = await this.twelveLabsService.generateSummaryFromVideo(
      videoId,
      prompt,
    );

    this.loggerService.log(
      JSON.stringify({
        message:
          'generateSummaryFromVideo[1]: ---------- Calling TLService - Completed ------------',
        data,
      }),
    );

    return responseGenerator('Generated', data);
  }

  async generateChapters(id: string, prompt?: string) {
    try {
      const video = await this.videoModel.findById(id);
      if (!video)
        throw new HttpException('Video not found', HttpStatus.NOT_FOUND);

      this.loggerService.log(
        JSON.stringify({
          message: `generateChapters: Video Found`,
          data: video,
        }),
      );

      const { tl_video_id: videoId } = video;

      this.loggerService.log(
        JSON.stringify({
          message:
            'generateChaptersFromVideo[1]: ---------- Calling TLService - Start ------------',
          data: { videoId, prompt },
        }),
      );

      const data = await this.twelveLabsService.generateChaptersFromVideo(
        videoId,
        prompt,
      );

      this.loggerService.log(
        JSON.stringify({
          message:
            'generateChaptersFromVideo[1]: ---------- Calling TLService - Completed ------------',
          data,
        }),
      );

      const transformChapter = data.map((chapter) => ({
        id: chapter.chapterNumber,
        summary: chapter.chapterSummary,
        title: chapter.chapterTitle,
        start: chapter.start,
        end: chapter.end,
      }));

      return responseGenerator('Generated', transformChapter);
    } catch (error) {
      this.loggerService.error(JSON.stringify(error));
      throw new HttpException('Error occured', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  srtTimeToSeconds(time: string): number {
    // Split the time string into hours, minutes, seconds, and milliseconds
    const [hours, minutes, secondsWithMs] = time.split(':');
    const [seconds, milliseconds] = secondsWithMs.split(',');

    // Convert each part to a number
    const hoursInSeconds = parseInt(hours, 10) * 3600;
    const minutesInSeconds = parseInt(minutes, 10) * 60;
    const secondsInSeconds = parseInt(seconds, 10);
    const msInSeconds = parseInt(milliseconds, 10) / 1000;

    // Sum up all parts to get the total time in seconds
    const totalSeconds =
      hoursInSeconds + minutesInSeconds + secondsInSeconds + msInSeconds;

    return totalSeconds;
  }

  /**
   * This function extracts short content from a video, processes it, and uploads segments to S3.
   *
   * Steps:
   * 1. Fetch video details from the database using the video ID.
   * 2. Check if the video exists; if not, throw an error.
   * 3. Determine the video URL, type, and extension.
   * 4. If the video is from YouTube and has not been downloaded yet:
   *    a. Download the high-quality video and audio from YouTube.
   *    b. Upload the downloaded video and audio to S3.
   *    c. Save the S3 URLs in the database.
   * 5. If the video is already downloaded:
   *    a. Get the storage URL.
   *    b. Download the video and audio if necessary.
   * 6. Create an SRT transcription:
   *    a. If the transcription exists in the database, use it.
   *    b. If not, generate the transcription using OpenAI service and save it in the database.
   * 7. Analyze the transcription to generate short-form content timestamps.
   * 8. Extract short content segments from the video based on the timestamps.
   * 9. Delete the local video file after extraction.
   * 10. Upload the extracted segments to S3 and get their URLs.
   * 11. Map the segments to their respective URLs.
   * 12. Return the final data containing segment URLs and details.
   * 13. Handle and log any errors that occur during the process.
   */
  async extractShortContent(id: string, body: ExtractShortContentDto) {
    const { aspect, total, duration, allow_contextual_merging } = body;
    try {
      this.loggerService.log(
        JSON.stringify({
          message: `extractShortContent: Fetching video with id ${id}`,
          data: { id },
        }),
      );

      const video = await this.videoModel.findById(id);
      if (!video) {
        this.loggerService.error(
          JSON.stringify({
            message: `extractShortContent: Video not found with id ${id}`,
            data: { id },
          }),
        );
        throw new HttpException('Video not found', HttpStatus.NOT_FOUND);
      }

      const { url, type: fileType, youtube_download_url } = video;
      let videoExtension = 'mp4';
      let storageUrl = url;
      let videoPath = '';
      let audioPath = '';

      this.loggerService.log(
        JSON.stringify({
          message: `extractShortContent: Downloading video from URL`,
          data: { url },
        }),
      );

      if (fileType === VIDEO_TYPES.YOUTUBE && !youtube_download_url) {
        this.loggerService.log(
          JSON.stringify({
            message: `extractShortContent: Downloading high-quality YouTube video`,
            data: { storageUrl },
          }),
        );

        const downloaded = await this.storageService.downloadHQYouTubeVideo(
          storageUrl,
          true,
        );
        videoPath = downloaded.video;
        audioPath = downloaded.audio;

        this.loggerService.log(
          JSON.stringify({
            message: `extractShortContent: Uploading video to S3`,
            data: { videoPath, audioPath },
          }),
        );

        const mimeType =
          mime.lookup(videoExtension) || `application/${videoExtension}`;
        const videoFileBuffer = readFileSync(videoPath);
        const s3VideoFilePath = await this.storageService.upload(
          videoFileBuffer,
          `${uuid()}.${videoExtension}`,
          mimeType,
        );
        const audioFileBuffer = readFileSync(audioPath);
        const s3AudioFilePath = await this.storageService.upload(
          audioFileBuffer,
          `${uuid()}.m4a`,
          'audio/m4a',
        );

        video.youtube_download_url = s3VideoFilePath;
        video.audio_url = s3AudioFilePath;
        await video.save();

        this.loggerService.log(
          JSON.stringify({
            message: `extractShortContent: Video and audio uploaded to S3`,
            data: { s3VideoFilePath, s3AudioFilePath },
          }),
        );
      } else {
        const getUrl =
          fileType === VIDEO_TYPES.YOUTUBE ? youtube_download_url : url;
        storageUrl = this.storageService.get(getUrl);
        const audioStorageUrl = this.storageService.get(video.audio_url);
        videoExtension = url.split('.').pop().split(/\#|\?/)[0];
        videoPath = await this.storageService.downloadVideo(
          storageUrl,
          `${uuid()}.mp4`,
        );
        if (!video.transcription) {
          audioPath = await this.storageService.downloadVideo(
            audioStorageUrl,
            `audio-${uuid}.m4a`,
          );
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: `extractShortContent: Creating SRT transcription`,
          data: { videoPath },
        }),
      );

      let transcription;
      if (video.transcription) {
        transcription = video.transcription;
      } else {
        transcription = await this.openAIService.transcribe({
          filePath: audioPath,
          response_format: TRANSCRIPTION_RESPONSE_FORMAT.SRT,
        });
        video.transcription = transcription;
        await video.save();
      }

      if (!transcription) {
        this.loggerService.error(
          JSON.stringify({
            message: `extractShortContent: No transcription found`,
            data: { videoPath },
          }),
        );
        throw new HttpException('No Transcription Found', HttpStatus.NOT_FOUND);
      }

      let extractedFiles: IExtractedShortFormContentResponse[];
      let shortsDbData;
      if (allow_contextual_merging) {
        const masterPrompt = generateContextualShortFormContent(
          transcription as unknown as string,
          total,
          duration,
        );

        // GENERATING TIMESTAMP USING GPT-4o
        const shortFormContentTimeStamp =
          await this.openAIService.chatCompletion({
            prompt: masterPrompt,
            model: OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_2024_08_06,
            responseFormat: CHAT_COMPLETION_RESPONSE_FORMAT.JSON_OBJECT,
          });

        const parsedOutput = JSON.parse(shortFormContentTimeStamp);

        const videoSegments: IContextualVideoSegment[] =
          parsedOutput.video_segments;

        const segmentsTimeLine = videoSegments.map((videoSegment) => ({
          parts: videoSegment.segments.map((part) => ({
            start: this.srtTimeToSeconds(part.start_time),
            end: this.srtTimeToSeconds(part.end_time),
          })),
        }));

        extractedFiles =
          await this.videoProcessorService.extractShortVideoAndMerge({
            videoPath,
            segments: segmentsTimeLine,
            videoExtension,
            metadata: video.metadata,
            aspect,
          });

        shortsDbData = videoSegments.map((data, index) => {
          const segments = data.segments.map((part) => ({
            start: this.srtTimeToSeconds(part.start_time),
            end: this.srtTimeToSeconds(part.end_time),
            context: part.context,
            duration: part.duration,
          }));
          return {
            segments,
            summary: data.explanation,
            title: data.title,
            url: extractedFiles[index].url,
            video_id: id,
            metadata: {
              width: extractedFiles[index].width,
              height: extractedFiles[index].height,
            },
            thumbnail: extractedFiles[index].thumbnail,
          };
        });
      } else {
        const masterPrompt = analyzeShortFormContentInTheVideo(
          transcription as unknown as string,
          total,
          duration,
        );

        // GENERATING TIMESTAMP USING CLAUDE

        // const shortFormContentTimeStamp = await this.claudeService.chatCompletion(
        //   {
        //     prompt: masterPrompt,
        //     max_tokens: 20000,
        //   },
        // );

        // GENERATING TIMESTAMP USING GPT-4o
        const shortFormContentTimeStamp =
          await this.openAIService.chatCompletion({
            prompt: masterPrompt,
            model: OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_2024_08_06,
            responseFormat: CHAT_COMPLETION_RESPONSE_FORMAT.JSON_OBJECT,
          });

        const parsedOutput = JSON.parse(shortFormContentTimeStamp);

        const videoSegments = parsedOutput.video_segments;

        const segmentsTimeLine = videoSegments.map((videoSegment) => ({
          start: this.srtTimeToSeconds(videoSegment.start_time),
          end: this.srtTimeToSeconds(videoSegment.end_time),
        }));

        this.loggerService.log(
          JSON.stringify({
            message: 'extractShortContent: Timeline generated',
            data: { segmentsTimeLine },
          }),
        );

        extractedFiles = await this.videoProcessorService.extractShortContent({
          videoPath,
          segments: segmentsTimeLine,
          videoExtension,
          metadata: video.metadata,
          aspect,
        });

        shortsDbData = videoSegments.map((data, index) => {
          return {
            start: this.srtTimeToSeconds(data.start_time),
            end: this.srtTimeToSeconds(data.end_time),
            summary: data.explanation,
            title: data.title,
            url: extractedFiles[index].url,
            video_id: id,
            metadata: {
              width: extractedFiles[index].width,
              height: extractedFiles[index].height,
            },
            thumbnail: extractedFiles[index].thumbnail,
          };
        });
      }

      await unlink(videoPath);

      if (audioPath) await unlink(audioPath);

      this.loggerService.log(
        JSON.stringify({
          message: `extractShortContent: Video extraction completed`,
          data: { extractedFiles },
        }),
      );

      const reelUrls = extractedFiles.map((file) =>
        this.storageService.get(file.url),
      );

      const createdShorts = await Promise.all(
        shortsDbData.map(async (shortData) => {
          const createdShort = new this.videoShortModel(shortData);
          await createdShort.save();
          return createdShort.toObject();
        }),
      );

      const createdShortsIds = createdShorts.map(
        (short) => short._id as ObjectId,
      );

      video.shorts = [...video.shorts, ...createdShortsIds];

      await video.save();

      const finalData = createdShorts.map((data, index) => ({
        ...data,
        url: reelUrls[index],
        thumbnail: this.storageService.get(data.thumbnail),
      }));

      this.loggerService.log(
        JSON.stringify({
          message: `extractShortContent: Process completed`,
          data: { finalData },
        }),
      );

      return finalData;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: `extractShortContent: Error occurred`,
          data: { error: error.message },
        }),
      );
      throw new HttpException('Error occurred', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async getAllGeneratedShortOfVideo(videoId: string) {
    try {
      const shorts = await this.videoShortModel
        .find({ video_id: videoId })
        .sort({ _id: -1 });
      return shorts.map((data) => ({
        ...data.toObject(),
        url: this.storageService.get(data.url),
        captionated_url: this.storageService.get(data.captionated_url),
        thumbnail: this.storageService.get(data.thumbnail),
      }));
    } catch (error) {
      throw new HttpException('Error occurred', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async addSubtitleToShort(shortId: string, body: AddSubtitleDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: `addSubtitleToShort: Starting process`,
          data: { shortId },
        }),
      );

      const short = await this.videoShortModel.findById(shortId);
      if (!short)
        throw new HttpException(
          'No Short found witht this ID',
          HttpStatus.NOT_FOUND,
        );
      let transcription = short.srt;

      this.loggerService.log(
        JSON.stringify({
          message: `addSubtitleToShort: Retrieved video short`,
          data: { short },
        }),
      );

      const preSignedVideoUrl = this.storageService.get(short.url);
      const videoPath = await this.storageService.downloadVideo(
        preSignedVideoUrl,
        short.url,
      );

      this.loggerService.log(
        JSON.stringify({
          message: `addSubtitleToShort: Video downloaded`,
          data: { videoPath },
        }),
      );

      const extension = extractExtension(short.url);

      if (!transcription) {
        const audioPath = await this.storageService.extractAudio(
          videoPath,
          `audio-${uuid()}.m4a`,
        );

        this.loggerService.log(
          JSON.stringify({
            message: `addSubtitleToShort: Audio extracted`,
            data: { audioPath },
          }),
        );

        const transcript = (await this.openAIService.transcribe({
          filePath: audioPath,
          response_format: TRANSCRIPTION_RESPONSE_FORMAT.SRT,
        })) as unknown as string;

        this.loggerService.log(
          JSON.stringify({
            message: `addSubtitleToShort: Transcription received`,
            data: { transcript },
          }),
        );

        short.srt = transcript;
        transcription = transcript;
        await short.save();

        this.loggerService.log(
          JSON.stringify({
            message: `addSubtitleToShort: Transcription saved`,
            data: { transcription },
          }),
        );

        await unlink(audioPath);
      }

      const payload = {
        fontName: body.font,
        fontSize: parseInt(body.font_size, 15),
        primaryColor: convertHexToV4StyleColor(
          body.font_color,
        ) as V4StyleColorEnum,
        bgColor: body.bg_color,
        borderStyle: body.bg_color ? 4 : 0,
        alignment: body.position === 'top' ? 8 : 2,
        bold: body.bold || false,
        italic: body.italic || false,
        outline: body.outline || 0,
        outlineColor: body.outline
          ? (convertHexToV4StyleColor(body.outline_color) as V4StyleColorEnum)
          : V4StyleColorEnum.Transparent,
      };
      if (!body.outline) {
        delete payload.outline;
        delete payload.outlineColor;
      }

      const style = generateV4Style(payload);

      const captionatedVideo =
        await this.videoProcessorService.addCaptionsToVideo(
          videoPath,
          transcription,
          style,
        );

      this.loggerService.log(
        JSON.stringify({
          message: `addSubtitleToShort: Captions added to video`,
          data: { captionatedVideo },
        }),
      );

      const fileBuffer = readFileSync(captionatedVideo);
      const s3FilePath = await this.storageService.upload(
        fileBuffer,
        `captionated-${uuid()}.${extension}`,
        `video/${extension}`,
      );

      this.loggerService.log(
        JSON.stringify({
          message: `addSubtitleToShort: Captioned video uploaded`,
          data: { s3FilePath },
        }),
      );

      short.captionated_url = s3FilePath;
      await short.save();

      this.loggerService.log(
        JSON.stringify({
          message: `addSubtitleToShort: Final short saved`,
          data: { short },
        }),
      );

      await unlink(videoPath);
      await unlink(captionatedVideo);

      return {
        ...short.toObject(),
        url: this.storageService.get(short.url),
        captionated_url: this.storageService.get(s3FilePath),
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: `addSubtitleToShort: Error occurred`,
          data: { error: error.message },
        }),
      );
      throw new HttpException('Error occurred', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async generateHighlights(videoId: string, prompt?: string) {
    this.loggerService.log(
      JSON.stringify({
        message:
          'generateHighlightsFromVideo[1]: ---------- Calling TLService - Start ------------',
        data: { videoId, prompt },
      }),
    );

    const data = await this.twelveLabsService.generateHighLightsFromVideo(
      videoId,
      prompt,
    );

    this.loggerService.log(
      JSON.stringify({
        message:
          'generateHighlightsFromVideo[1]: ---------- Calling TLService - Completed ------------',
        data,
      }),
    );

    return responseGenerator('Generated', data);
  }

  async retrieveVideoInfoFromTLAndSave(taskId: string) {
    this.loggerService.log(
      JSON.stringify({
        message: `retrieveVideoIDFromTLAndSave: ---------- Retrieving Video from DB for ${taskId} - Start ------------`,
      }),
    );

    const video = await this.videoModel.findOne({ tl_task_id: taskId });

    this.loggerService.log(
      JSON.stringify({
        message: `retrieveVideoIDFromTLAndSave: ---------- Retrieving Video from DB for ${taskId} - Completed ------------`,
        data: video,
      }),
    );

    if (!video) {
      this.loggerService.log(
        JSON.stringify({
          message: `retrieveVideoIDFromTLAndSave: Video not found in DB for taskId ${taskId}`,
        }),
      );
      return;
    }

    this.loggerService.log(
      JSON.stringify({
        message: `retrieveVideoIDFromTLAndSave: ---------- Retrieving Task Info for ${video.tl_task_id} - Start ------------`,
      }),
    );

    const taskInfo = (await this.twelveLabsService.retrieveTaskInfo(
      video.tl_task_id,
    )) as any;

    const videoInfo = await this.twelveLabsService.retrieveVideoInfo(
      taskInfo.videoId,
    );

    this.loggerService.log(
      JSON.stringify({
        message: `retrieveVideoIDFromTLAndSave: ---------- Retrieving Task Info for ${video.tl_task_id} - Completed ------------`,
      }),
    );

    video.tl_video_id = taskInfo.videoId as string;

    video.metadata = {
      width: videoInfo?.metadata?.width,
      height: videoInfo?.metadata?.height,
    };

    await video.save();

    this.loggerService.log(
      JSON.stringify({
        message: `retrieveVideoIDFromTLAndSave: ---------- Video ID saved to DB for ${taskId} - Completed ------------`,
      }),
    );

    return responseGenerator();
  }

  async uploadToYoutube(
    userId: string,
    videoDetails: any,
    video: Express.Multer.File,
  ) {
    this.loggerService.log(
      JSON.stringify({
        message: `uploadToYoutube: ---------- Uploading Video for user ${userId} - Start ------------`,
      }),
    );

    try {
      const user = await this.userService.getUserById(userId);
      const accessToken = user.google_access_token;

      const oauth2Client = new auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const youtube = _youtube({ version: 'v3', auth: oauth2Client });

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: videoDetails.title,
            description: videoDetails.description,
            tags: videoDetails.tags,
          },
          status: {
            privacyStatus: videoDetails.privacyStatus,
          },
        },
        media: {
          body: createReadStream(video.path),
        },
      });

      await unlink(video.path);

      this.loggerService.log(
        JSON.stringify({
          message: `uploadToYoutube: ---------- Video Uploaded for user ${userId} - Completed ------------`,
          data: response.data,
        }),
      );

      return response.data;
    } catch (error) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error Uploading video:',
          error,
        }),
      );
      throw new HttpException('Error occured', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async listYoutubeVideos(userId: string) {
    this.loggerService.log(
      JSON.stringify({
        message: `listYoutubeVideos: ---------- Listing Videos for user ${userId} - Start ------------`,
      }),
    );

    try {
      const user = await this.userService.getUserById(userId);

      if (!user) {
        this.loggerService.log(
          JSON.stringify({
            message: `listYoutubeVideos: No user with this id ${userId}`,
          }),
        );
        throw new HttpException('No user with this id', HttpStatus.NOT_FOUND);
      }

      const accessToken = user.google_access_token;

      const oauth2Client = new auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const youtube = _youtube({ version: 'v3', auth: oauth2Client });

      const response = await youtube.search.list({
        part: ['id', 'snippet'],
        forMine: true,
        type: ['video'],
        maxResults: 20,
      });

      this.loggerService.log(
        JSON.stringify({
          message: `listYoutubeVideos: Videos retrieved for user ${userId}`,
          data: response.data.items,
        }),
      );

      const videoIds = response.data.items.map((item) => item.id.videoId);

      if (videoIds.length === 0) {
        this.loggerService.log(
          JSON.stringify({
            message: `listYoutubeVideos: No videos found for user ${userId}`,
          }),
        );
        return;
      }

      const videoResponse = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds,
      });

      const transformedVideoResponse = videoResponse.data.items.map((item) => ({
        id: item.id,
        thumbnail: item.snippet.thumbnails,
        title: item.snippet.title,
        description: item.snippet.description,
      }));

      this.loggerService.log(
        JSON.stringify({
          message: `listYoutubeVideos: Video details retrieved for user ${userId} - Completed`,
          data: transformedVideoResponse,
        }),
      );

      return transformedVideoResponse;
    } catch (error) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error Listing videos',
          error,
        }),
      );
      throw new HttpException('Error occured', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async extractFramesFromVideoSegment(
    videoId: string,
    startTime: number,
    endTime: number,
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'extractFramesFromVideoSegment: Start',
          data: { videoId, startTime, endTime },
        }),
      );

      const video = await this.videoModel.findById(videoId);
      this.loggerService.log(
        JSON.stringify({
          message: 'extractFramesFromVideoSegment: Video fetched',
          data: { videoId, videoUrl: video.url },
        }),
      );

      const preSignedVideoUrl = this.storageService.get(video.url);
      const filePath =
        await this.storageService.downloadFileFromUrl(preSignedVideoUrl);
      this.loggerService.log(
        JSON.stringify({
          message: 'extractFramesFromVideoSegment: Video downloaded',
          data: { filePath },
        }),
      );

      const frames = [];

      for (let time = startTime; time <= endTime; time++) {
        const s3ImageFilePath =
          await this.videoProcessorService.extractThumbnail(filePath, time);
        this.loggerService.log(
          JSON.stringify({
            message: 'extractFramesFromVideoSegment: Frame extracted',
            data: { time, s3ImageFilePath },
          }),
        );
        const url = this.storageService.get(s3ImageFilePath);
        frames.push({ time, s3ImageFilePath, url });
      }

      await unlink(filePath);
      this.loggerService.log(
        JSON.stringify({
          message: 'extractFramesFromVideoSegment: Temporary file deleted',
          data: { filePath },
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'extractFramesFromVideoSegment: Frames extraction completed',
          data: { frames },
        }),
      );

      return frames;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'extractFramesFromVideoSegment: Error extracting frames',
          data: { error: error.message },
        }),
      );
      throw new HttpException(
        'Error extracting frames',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
