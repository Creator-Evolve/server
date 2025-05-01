import { ConfigService } from '@/common/config/services/config.service';
import { HttpService } from '@/common/http/services/http.service';
import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { lastValueFrom } from 'rxjs';
import { v4 as uuid } from 'uuid';
// import * as ytdl from 'ytdl-core';
import { exec } from 'child_process';
import { LoggerService } from '@/common/logger/services/logger.service';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import * as ytdl from '@distube/ytdl-core';
import HttpsProxyAgent from 'https-proxy-agent';
import HttpProxyAgent from 'http-proxy-agent';
import * as https from 'https';
import * as http from 'http';

import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@Injectable()
export class StorageService {
  private readonly s3: S3;
  private proxyList: string[] = [
    '152.26.229.42:9443',
    '152.26.229.66:9443',
    '152.26.229.88:9443',
    '152.26.231.42:9443',
    '152.26.231.77:9443',
    '152.26.231.86:9443',
    '177.234.241.25:999',
    '177.234.241.26:999',
    '177.234.241.27:999',
    '177.234.241.30:999',
  ];
  private currentProxyIndex = 0;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private loggerService: LoggerService,
  ) {
    this.s3 = new S3();
  }

  private getNextProxy(): string {
    const proxy = this.proxyList[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
    return proxy;
  }

  private getProxyAgent() {
    const proxy = this.getNextProxy();
    this.loggerService.log(
      JSON.stringify({
        message: 'Using proxy',
        data: proxy,
      })
    );
    
    // For ytdl-core we need to set up request clients
    const httpAgent = new http.Agent();
    const httpsAgent = new https.Agent();
    
    // Set up the proxy options for ytdl-core
    const proxyUrl = `http://${proxy}`;
    
    return {
      proxy: proxyUrl,
      // Standard http/https agents for other uses
      httpAgent: new HttpProxyAgent.HttpProxyAgent(proxyUrl),
      httpsAgent: new HttpsProxyAgent.HttpsProxyAgent(proxyUrl)
    };
  }

  async upload(dataBuffer: Buffer, filename: string, mimetype: string) {
    this.loggerService.log('Uploading file to S3', 'StorageService');
    const uploadResult = await this.s3
      .upload({
        Bucket: this.configService.get('AWS_BUCKET_NAME'),
        Body: dataBuffer,
        Key: `${uuid()}-${filename}`,
        ContentType: mimetype,
      })
      .promise();

    const filePath = this.extractFileNameFromS3Url(uploadResult.Location);
    this.loggerService.log(
      `File uploaded to S3 with key: ${filePath}`,
      'StorageService',
    );

    return filePath;
  }

  async uploadStream(
    stream: NodeJS.ReadableStream,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    const uploadParams = {
      Bucket: this.configService.get('AWS_BUCKET_NAME'),
      Key: `${uuid()}-${filename}`,
      Body: stream,
      ContentType: mimetype,
    };

    const uploadResult = await this.s3.upload(uploadParams).promise();

    const filePath = this.extractFileNameFromS3Url(uploadResult.Location);
    this.loggerService.log(
      `File uploaded to S3 with key: ${filePath}`,
      'StorageService',
    );

    return filePath;
  }

  private removeSpecialCharacters(str: string): string {
    return str.replace(/[<>:"/\\|?*]+/g, '');
  }

  private createDirectoryIfNotExists(directory: string) {
    if (!existsSync(directory)) {
      mkdirSync(directory);
      this.loggerService.log(
        `Directory created: ${directory}`,
        'StorageService',
      );
    }
  }

  async downloadHQYouTubeVideo(
    url: string,
    keepAudio: boolean = false,
  ): Promise<{ video: string; audio: string }> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Downloading YouTube video',
          data: url,
        })
      );
      
      const proxyAgents = this.getProxyAgent();
      
      // Configure ytdl options with correct proxy format
      const options = {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
          },
        },
      };
      
      // Set the proxy via environment variables before calling ytdl
      process.env.HTTP_PROXY = proxyAgents.proxy;
      process.env.HTTPS_PROXY = proxyAgents.proxy;
      
      const videoInfo = await ytdl.getInfo(url, options);
      const videoTitle = this.removeSpecialCharacters(
        videoInfo.videoDetails.title,
      );
      
      this.loggerService.log(
        JSON.stringify({
          message: 'Retrieved video info',
          data: videoTitle,
        })
      );

      const uploadDir = join(__dirname, '..', '..', '../..', 'uploads');
      this.createDirectoryIfNotExists(uploadDir);

      const videoFilePath = join(uploadDir, `${videoTitle}_video.mp4`);
      const audioFilePath = join(uploadDir, `${videoTitle}_audio.m4a`);
      const outputFilePath = join(uploadDir, `${videoTitle}.mp4`);

      if (existsSync(outputFilePath)) {
        this.loggerService.error(
          `File "${outputFilePath}" already exists. Skipping.`,
          '',
          'StorageService',
        );
        return { video: outputFilePath, audio: audioFilePath };
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'Downloading video stream',
          data: videoTitle,
        })
      );
      const videoFormat = ytdl.chooseFormat(videoInfo.formats, {
        quality: 'highestvideo',
      });
      const videoStream = ytdl.downloadFromInfo(videoInfo, {
        format: videoFormat,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
          },
        },
      });
      videoStream.pipe(createWriteStream(videoFilePath));
      await new Promise((resolve) => videoStream.on('end', resolve));

      this.loggerService.log(
        JSON.stringify({
          message: 'Downloading audio stream',
          data: videoTitle,
        })
      );
      const audioFormat = ytdl.chooseFormat(videoInfo.formats, {
        quality: 'highestaudio',
      });
      const audioStream = ytdl.downloadFromInfo(videoInfo, {
        format: audioFormat,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
          },
        },
      });
      audioStream.pipe(createWriteStream(audioFilePath));
      await new Promise((resolve) => audioStream.on('end', resolve));

      this.loggerService.log(
        JSON.stringify({
          message: 'Merging video and audio streams',
          data: videoTitle,
        })
      );
      const mergeCommand = `ffmpeg -i "${videoFilePath}" -i "${audioFilePath}" -c:v copy -c:a aac "${outputFilePath}"`;
      await new Promise<void>((resolve, reject) => {
        exec(mergeCommand, (error, stdout, stderr) => {
          if (error) {
            this.loggerService.error(
              `Error merging: ${error.message}`,
              '',
              'StorageService',
            );
            reject(error);
          } else {
            this.loggerService.log(
              JSON.stringify({
                message: 'Video downloaded and merged',
                data: videoTitle,
              })
            );
            unlinkSync(videoFilePath);
            if (!keepAudio) unlinkSync(audioFilePath);

            resolve();
          }
        });
      });

      // Clean up environment variables
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;

      return { video: outputFilePath, audio: audioFilePath };
    } catch (error: any) {
      // Clean up environment variables in case of error
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      
      this.loggerService.error(
        `Error processing video: ${error.message}`,
        '',
        'StorageService',
      );
      throw error;
    }
  }

  async downloadVideo(url: string, filename: string): Promise<string> {
    if (!url) return;
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Downloading video from URL',
          data: url,
        })
      );
      let videoPath = join(__dirname, '..', '..', '../..', 'uploads', filename);
      let writer = createWriteStream(videoPath);

      if (ytdl.validateURL(url)) {
        this.loggerService.log(
          JSON.stringify({
            message: 'Detected YouTube URL, downloading via ytdl-core',
            data: url,
          })
        );
        
        const proxyAgents = this.getProxyAgent();
        
        // Set the proxy via environment variables
        process.env.HTTP_PROXY = proxyAgents.proxy;
        process.env.HTTPS_PROXY = proxyAgents.proxy;
        
        const youtubeStream = ytdl(url, {
          quality: 'highestvideo',
          filter: 'audioandvideo',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
            },
          },
        });
        
        youtubeStream.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            // Clean up environment variables
            delete process.env.HTTP_PROXY;
            delete process.env.HTTPS_PROXY;
            
            this.loggerService.log(
              JSON.stringify({
                message: 'Video downloaded to',
                data: videoPath,
              })
            );
            resolve(videoPath);
          });
          writer.on('error', (error) => {
            // Clean up environment variables in case of error
            delete process.env.HTTP_PROXY;
            delete process.env.HTTPS_PROXY;
            
            this.loggerService.error(
              `Error downloading video: ${error.message}`,
              '',
              'StorageService',
            );
            reject(error);
          });
        });
      } else {
        this.loggerService.log('Downloading video via HTTP', 'StorageService');
        const response = await lastValueFrom(
          this.httpService.get(url, { responseType: 'stream' }),
        );

        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            this.loggerService.log(
              JSON.stringify({
                message: 'Video downloaded to',
                data: videoPath,
              })
            );
            resolve(videoPath);
          });
          writer.on('error', (error) => {
            this.loggerService.error(
              `Error downloading video: ${error.message}`,
              '',
              'StorageService',
            );
            reject(error);
          });
        });
      }
    } catch (error: any) {
      // Clean up environment variables in case of error
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      
      this.loggerService.error(
        `Error downloading video: ${error.message}`,
        '',
        'StorageService',
      );
      throw new Error(JSON.stringify(error));
    }
  }

  async extractAudio(videoPath: string, filename: string): Promise<string> {
    if (!videoPath || !filename) return;

    const audioPath = join(__dirname, '..', '..', '../..', 'uploads', filename);

    try {
      this.loggerService.log(
        `Extracting audio from video: ${videoPath}`,
        'StorageService',
      );

      await this.extractAudioFromFile(videoPath, audioPath);

      this.loggerService.log(
        `Audio extracted to: ${audioPath}`,
        'StorageService',
      );
      return audioPath;
    } catch (error: any) {
      this.loggerService.error(
        `Error extracting audio: ${error.message}`,
        'StorageService',
      );
      throw new Error(JSON.stringify(error));
    }
  }

  private async extractAudioFromFile(
    videoPath: string,
    audioPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('copy')
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  get(filename: string) {
    if (!filename) return;

    const fileUrl = `${this.configService.get('AWS_CLOUDFRONT_DISTRIBUTION')}/${filename}`;

    const preSignedUrl = getSignedUrl({
      url: fileUrl,
      dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toString(),
      keyPairId: this.configService.get('AWS_CLOUDFRONT_KEY_PAIR'),
      privateKey: this.configService.get('AWS_CLOUDFRONT_PRIVATE_KEY'),
    });
    this.loggerService.log(
      `Retrieved file URL: ${preSignedUrl}`,
      'StorageService',
    );
    return preSignedUrl;
  }

  async delete(filename: string) {
    if (!filename) {
      const errorMessage = 'Filename is required for deletion';
      this.loggerService.error(errorMessage, '', 'StorageService');
      throw new Error(errorMessage);
    }

    const params = {
      Bucket: this.configService.get('AWS_BUCKET_NAME'),
      Key: filename,
    };

    try {
      await this.s3.deleteObject(params).promise();
      this.loggerService.log(
        `File successfully deleted from S3: ${filename}`,
        'StorageService',
      );
      return { message: 'File successfully deleted from S3' };
    } catch (error) {
      this.loggerService.error(
        'Error deleting file from S3',
        '',
        'StorageService',
      );
      throw new Error('Error deleting file from S3');
    }
  }

  extractFileNameFromS3Url(url: string) {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      this.loggerService.log(
        `Extracted filename from S3 URL: ${filename}`,
        'StorageService',
      );
      return filename;
    } catch (error) {
      this.loggerService.error(
        'Error extracting filename from S3 URL',
        '',
        'StorageService',
      );
      return null;
    }
  }

  extractFileNameFromPresignedUrl(url: string) {
    // Split the URL by '?' to separate the path from the query parameters
    const [path] = url.split('?');

    // Split the path by '/' to get the last segment which contains the file name
    const segments = path.split('/');
    const fileName = segments.pop();

    // Split the file name by '.' to get the extension
    const parts = fileName.split('.');
    const extension = parts.pop();

    return extension;
  }

  private getFileExtension(url: string): string {
    return extname(url.split('?')[0]);
  }

  async generateUploadUrl(fileName: string) {
    const params = {
      Bucket: this.configService.get('AWS_BUCKET_NAME'),
      Key: fileName,
      Expires: 3600,
    };

    const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
    return uploadUrl;
  }

  async downloadFileFromUrl(url: string): Promise<string> {
    const directory = join(__dirname, '..', '..', '../..', 'uploads');

    this.createDirectoryIfNotExists(directory);
    const fileExtension = this.getFileExtension(url);
    const tempFilePath = join(directory, `${uuid()}${fileExtension}`); // Generate a temporary file name with the correct extension
    const writer = createWriteStream(tempFilePath);

    const response = await lastValueFrom(
      this.httpService.get(url, { responseType: 'stream' }),
    );

    response.data.pipe(writer);

    return new Promise<string>((resolve, reject) => {
      writer.on('finish', () => resolve(tempFilePath));
      writer.on('error', reject);
    });
  }

  async downloadImageAsBuffer(url: string): Promise<Buffer> {
    const response = await lastValueFrom(
      this.httpService.get(url, { responseType: 'arraybuffer' }),
    );
    return Buffer.from(response.data);
  }
}
