import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { join } from 'path';
import { secondsToHms } from '../helper/convertSecsToHS';
import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { readFileSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import { generateV4Style, V4StyleColorEnum, V4StyleProps } from 'utils/v4Style';
import { generateCustomAssContent } from '../helper/generateCustomAss';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface ISegment {
  start: number;
  end: number;
}

export interface ISegmentCrop {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface IExtractedShortFormContentResponse {
  url: string;
  width: number;
  height: number;
  thumbnail: string;
}

@Injectable()
export class VideoProcessorService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly storageService: StorageService,
  ) {}

  async extractShortContent({
    segments,
    videoExtension,
    videoPath,
    aspect,
    crop,
    metadata,
  }: {
    videoPath: string;
    segments: ISegment[];
    videoExtension: string;
    crop?: ISegmentCrop;
    metadata?: { width: number; height: number };
    aspect?: string;
  }): Promise<IExtractedShortFormContentResponse[]> {
    const outputFiles: IExtractedShortFormContentResponse[] = [];
    try {
      for (const segment of segments) {
        const outputFilePath = join(
          __dirname,
          '..',
          '..',
          '../..',
          'uploads',
          `segment-${Date.now()}.mp4`,
        );
        this.loggerService.log(
          ` extractShortContent: -------- Extracting segment from ${segment.start} to ${segment.end} of aspect ${aspect} --------`,
        );
        await this.extractSegment(
          videoPath,
          segment.start,
          segment.end,
          crop,
          outputFilePath,
          metadata,
          aspect,
        );

        const fileBuffer = readFileSync(outputFilePath);

        // Saving video in s3
        const s3FilePath = await this.storageService.upload(
          fileBuffer,
          `segment-${Date.now()}.mp4`,
          `video/${videoExtension}`,
        );

        const { height, width } = await this.getVideoDimension(outputFilePath);

        const thumbnail = await this.extractThumbnail(outputFilePath);

        await unlink(outputFilePath);

        outputFiles.push({ url: s3FilePath, width, height, thumbnail });
      }
    } catch (error) {
      this.loggerService.error(
        `extractShortContent: -------- Error during video extraction: ${JSON.stringify(error)} --------,`,
      );
      throw new HttpException(
        'Error during video extraction',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return outputFiles;
  }

  private mergeSegments(
    inputFiles: string[],
    outputFile: string,
  ): Promise<void> {
    const functionName = 'mergeSegments';

    return new Promise((resolve, reject) => {
      try {
        const command = ffmpeg();

        inputFiles.forEach((file) => {
          command.input(file);
        });

        const filterComplex =
          inputFiles.map((_, index) => `[${index}:v][${index}:a]`).join('') +
          `concat=n=${inputFiles.length}:v=1:a=1[outv][outa]`;

        command
          .complexFilter(filterComplex)
          .outputOptions(['-map [outv]', '-map [outa]'])
          .output(outputFile)
          .on('end', () => {
            this.loggerService.log(
              JSON.stringify({
                message: `${functionName}: Merging finished successfully`,
              }),
            );
            resolve();
          })
          .on('error', (error) => {
            this.loggerService.error(
              JSON.stringify({
                message: `${functionName}: Error merging segments`,
                error: error.message,
              }),
            );
            reject(new Error('Failed to merge video segments'));
          })
          .run();
      } catch (error: any) {
        this.loggerService.error(
          JSON.stringify({
            message: `${functionName}: Error merging segments`,
            error: error.message,
          }),
        );
        reject(new Error('Failed to merge video segments'));
      }
    });
  }

  async extractShortVideoAndMerge({
    segments,
    videoExtension,
    videoPath,
    aspect,
    crop,
    metadata,
  }: {
    videoPath: string;
    segments: { parts: ISegment[] }[];
    videoExtension: string;
    crop?: ISegmentCrop;
    metadata?: { width: number; height: number };
    aspect?: string;
  }): Promise<IExtractedShortFormContentResponse[]> {
    const outputFiles: IExtractedShortFormContentResponse[] = [];
    const functionName = 'extractShortVideoAndMerge';

    try {
      for (const segment of segments) {
        const segmentFiles = [];
        const mergedSegmentOutputPath = join(
          __dirname,
          '..',
          '..',
          '../..',
          'uploads',
          `merged-segment-${Date.now()}.mp4`,
        );

        for (const part of segment.parts) {
          const partOutputPath = join(
            __dirname,
            '..',
            '..',
            '../..',
            'uploads',
            `part-${Date.now()}.mp4`,
          );

          this.loggerService.log(
            `${functionName}------logs ------ Extracting segment from ${part.start} to ${part.end} of aspect ${aspect} to ${partOutputPath}`,
          );

          await this.extractSegment(
            videoPath,
            part.start,
            part.end,
            crop,
            partOutputPath,
            metadata,
            aspect,
          );
          segmentFiles.push(partOutputPath);
        }

        this.loggerService.log(
          `${functionName}------logs ------ Merging extracted segments into ${mergedSegmentOutputPath}`,
        );

        await this.mergeSegments(segmentFiles, mergedSegmentOutputPath);

        const fileBuffer = readFileSync(mergedSegmentOutputPath);

        this.loggerService.log(
          `${functionName}------logs ------ Uploading merged segment to S3`,
        );

        // Saving video in s3
        const s3FilePath = await this.storageService.upload(
          fileBuffer,
          `segment-${Date.now()}.mp4`,
          `video/${videoExtension}`,
        );

        this.loggerService.log(
          `${functionName}------logs ------ Uploaded merged segment to S3 at ${s3FilePath}`,
        );

        const shortVideoMetadata = await this.getVideoDimension(
          mergedSegmentOutputPath,
        );

        const thumbnail = await this.extractThumbnail(mergedSegmentOutputPath);

        await unlink(mergedSegmentOutputPath);

        for (const file of segmentFiles) {
          await unlink(file);
        }

        outputFiles.push({
          url: s3FilePath,
          width: shortVideoMetadata.width,
          height: shortVideoMetadata.height,
          thumbnail,
        });
      }
    } catch (error) {
      this.loggerService.error(
        `${functionName}------logs ------ Error during video extraction and merging: ${JSON.stringify(error)}`,
      );
      throw new HttpException(
        'Error during video extraction and merging',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.loggerService.log(
      `${functionName}------logs ------ Finished processing all segments`,
    );

    return outputFiles;
  }

  async addCaptionsToVideo(
    inputVideoPath: string,
    srtText: string,
    style: string,
  ): Promise<string> {
    const functionName = 'addCaptionsToVideo';
    return new Promise((resolve, reject) => {
      try {
        // Generate paths for subtitle files
        const inputDir = path.dirname(inputVideoPath);
        const subtitleFileName = `subtitles_${Date.now()}`;
        const srtPath = path.join(inputDir, `${subtitleFileName}.srt`);
        const assPath = path.join(inputDir, `${subtitleFileName}.ass`);

        // Generate output video path
        const outputFileName = `captioned_${path.basename(inputVideoPath)}`;
        const outputFilePath = path.join(inputDir, 'captioned', outputFileName);

        // Ensure the output directory exists
        fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

        // Write the SRT text to a file
        fs.writeFileSync(srtPath, srtText);

        // Convert SRT to ASS
        ffmpeg(srtPath)
          .output(assPath)
          .on('end', () => {
            this.loggerService.log(
              `${functionName} ---- Converted SRT to ASS: ${assPath} ----`,
            );
            fs.readFile(assPath, 'utf-8', (err, data) => {
              if (err) {
                this.loggerService.error(
                  `${functionName} ---- Error reading the file: ${err} ----`,
                );
                return reject(err);
              }

              // Modify the content
              const eventIndex = data.indexOf('[Events]');
              const eventText = data.slice(eventIndex);

              const v4Style =
                style ||
                generateV4Style({
                  primaryColor: V4StyleColorEnum.Red,
                  fontSize: 12,
                  // italic: true,
                  bgColor: V4StyleColorEnum.Blue,
                  borderStyle: 0,
                  // backColor: V4StyleColorEnum.Black,
                  shadow: 0,
                  outline: 2,
                });

              this.loggerService.log(
                JSON.stringify({
                  message: `addCaptionsToVideo: ----- v4+ Style Genererated ------`,
                  data: v4Style,
                }),
              );
              const modifiedContent = generateCustomAssContent(
                eventText,
                v4Style,
              );

              // Write the modified content back to the file
              fs.writeFile(assPath, modifiedContent, 'utf8', (err) => {
                if (err) {
                  this.loggerService.error(
                    `${functionName} ---- Error writing to the file: ${err} ----`,
                  );
                  return reject(err);
                }
                this.loggerService.log(
                  `${functionName} ---- File has been successfully updated ----`,
                );
                ffmpeg.ffprobe(inputVideoPath, (err, metadata) => {
                  if (err) return reject(err);

                  const { width, height } = metadata.streams[0];
                  const escapedAssPath = assPath.replace(/\\/g, '/').slice(2);

                  this.loggerService.log(
                    `${functionName} ---- Video dimensions: ${width}x${height} ----`,
                  );
                  this.loggerService.log(
                    `${functionName} ---- Using ASS file: ${escapedAssPath} ----`,
                  );

                  ffmpeg(inputVideoPath)
                    .videoFilter(`ass='C\\:${escapedAssPath}'`)
                    .outputOptions('-c:a copy')
                    .output(outputFilePath)
                    .on('start', (cmd) => {
                      this.loggerService.log(
                        `${functionName} ---- FFmpeg command: ${cmd} ----`,
                      );
                    })
                    .on('end', () => {
                      this.loggerService.log(
                        `${functionName} ---- Output video created: ${outputFilePath} ----`,
                      );

                      // Clean up the temporary subtitle files
                      fs.unlinkSync(srtPath);
                      fs.unlinkSync(assPath);

                      resolve(outputFilePath);
                    })
                    .on('error', (err) => {
                      this.loggerService.error(
                        `${functionName} ---- FFmpeg error: ${err} ----`,
                      );
                      reject(err);
                    })
                    .run();
                });
              });
            });
          })
          .on('error', (err) => {
            this.loggerService.error(
              `${functionName} ---- Error converting SRT to ASS: ${err} ----`,
            );
            reject(err);
          })
          .run();
      } catch (error) {
        this.loggerService.error(
          `${functionName} ---- Error in addCaptionsToVideo: ${error} ----`,
        );
        reject(error);
      }
    });
  }

  private getVideoDimension(
    videoPath: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          this.loggerService.error(
            `Error getting video metadata: ${err.message}`,
          );
          reject(
            new HttpException(
              'Error getting video metadata',
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          );
          return;
        }

        const { width, height } = metadata.streams[0];
        resolve({ width, height });
      });
    });
  }

  private extractSegment(
    videoPath: string,
    startTime: number,
    endTime: number,
    crop: { width: number; height: number; x: number; y: number } | undefined,
    outputFilePath: string,
    metadata?: { width: number; height: number },
    aspect?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = secondsToHms(startTime);
      const duration = endTime - startTime; // Calculate the duration correctly

      this.loggerService.log(
        `extractSegment: -------- Video Duration: start=${start}, duration=${duration}, crop=${JSON.stringify(crop)} --------`,
      );

      let command = ffmpeg(videoPath)
        .setStartTime(start)
        .setDuration(duration)
        .output(outputFilePath);

      if (crop) {
        command = command.videoFilters(
          `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
        );
      } else {
        const aspectRatio = aspect ? Number(aspect) : 9 / 16;

        const applyCrop = (width: number, height: number) => {
          const cropWidth = Math.min(width, height * aspectRatio);
          const cropHeight = Math.min(height, width / aspectRatio);
          const x = (width - cropWidth) / 2;
          const y = (height - cropHeight) / 2;

          command.videoFilters(`crop=${cropWidth}:${cropHeight}:${x}:${y}`);

          this.loggerService.log(
            `extractSegment: -------- Video Ratio: cropWidth=${cropWidth}, cropHeight=${cropHeight}, x=${x}, y=${y}, aspectRatio=${aspectRatio} --------`,
          );
        };

        if (!metadata || !metadata?.width || !metadata?.height) {
          ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
              this.loggerService.error(
                `Error getting video metadata: ${err.message}`,
              );
              reject(
                new HttpException(
                  'Error getting video metadata',
                  HttpStatus.INTERNAL_SERVER_ERROR,
                ),
              );
              return;
            }

            const { width, height } = metadata.streams[0];
            applyCrop(width, height);

            command
              .on('end', () => {
                this.loggerService.log(
                  `extractSegment: -------- Segment extracted to ${outputFilePath} --------`,
                );
                resolve();
              })
              .on('error', (err) => {
                this.loggerService.error(
                  `extractSegment: -------- Error extracting segment: ${err.message} --------`,
                );
                reject(
                  new HttpException(
                    'Error extracting segment',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                  ),
                );
              })
              .run();
          });
        } else {
          const { width, height } = metadata;
          applyCrop(width, height);

          command
            .on('end', () => {
              this.loggerService.log(
                `extractSegment: -------- Segment extracted to ${outputFilePath} --------`,
              );
              resolve();
            })
            .on('error', (err) => {
              this.loggerService.error(
                `extractSegment: -------- Error extracting segment: ${err.message} --------`,
              );
              reject(
                new HttpException(
                  'Error extracting segment',
                  HttpStatus.INTERNAL_SERVER_ERROR,
                ),
              );
            })
            .run();
        }
      }
    });
  }

  async extractThumbnail(
    videoPath: string,
    atTime: number = 0,
  ): Promise<string> {
    const tempThumbnailPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'uploads',
      `thumbnail-${Date.now()}.webp`,
    );

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [atTime],
          filename: tempThumbnailPath,
          quality: 1,
        })
        .on('end', async () => {
          try {
            const fileBuffer = await readFile(tempThumbnailPath);
            const s3FilePath = await this.storageService.upload(
              fileBuffer,
              `thumbnail-${Date.now()}.webp`,
              'image/webp',
            );
            await unlink(tempThumbnailPath);
            this.loggerService.log(
              `extractThumbnail: -------- Thumbnail extracted and uploaded to ${s3FilePath} --------`,
            );
            resolve(s3FilePath);
          } catch (error: any) {
            this.loggerService.error(
              `extractThumbnail: -------- Error uploading thumbnail: ${error.message} --------`,
            );
            reject(
              new HttpException(
                'Error uploading thumbnail',
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
            );
          }
        })
        .on('error', (err) => {
          this.loggerService.error(
            `extractThumbnail: -------- Error extracting thumbnail: ${err.message} --------`,
          );
          reject(
            new HttpException(
              'Error extracting thumbnail',
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          );
        });
    });
  }
}
