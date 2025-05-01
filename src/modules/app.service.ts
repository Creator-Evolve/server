import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Readable } from 'stream';

@Injectable()
export class AppService {
  constructor(
    private storageService: StorageService,
    private loggerService: LoggerService,
  ) {
  }

  async uploadFile(file: Express.Multer.File) {
    this.loggerService.log('uploadFile: Starting file upload process');

    try {
      this.loggerService.log('uploadFile: Converting buffer to stream');
      const fileStream = this.bufferToStream(file.buffer);

      this.loggerService.log(
        `uploadFile: Uploading file to S3 - ${file.originalname}`,
      );
      const s3FilePath = await this.storageService.uploadStream(
        fileStream,
        file.originalname,
        file.mimetype,
      );

      this.loggerService.log(
        `uploadFile: File uploaded successfully - ${s3FilePath}`,
      );

      const preSignedUrl = this.storageService.get(s3FilePath);

      return { url: preSignedUrl, key: s3FilePath };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'uploadFile: Error occurred during file upload',
          data: error,
        }),
      );
      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  private bufferToStream(buffer: Buffer): Readable {
    this.loggerService.log(
      'bufferToStream: Creating readable stream from buffer',
    );
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null); // Indicates the end of the stream
    return stream;
  }

  async getUrlForUpload(fileName: string) {
    try {
      // Log the start of the URL generation process
      this.loggerService.log(
        JSON.stringify({
          message: 'getUrlForUpload: Start generating upload URL',
          fileName,
        }),
      );

      // Generate the presigned upload URL
      const url = await this.storageService.generateUploadUrl(fileName);

      // Log the successful generation of the URL
      this.loggerService.log(
        JSON.stringify({
          message: 'getUrlForUpload: Successfully generated upload URL',
          fileName,
          url,
        }),
      );

      return url;
    } catch (error: any) {
      // Log the error that occurred during URL generation
      this.loggerService.log(
        JSON.stringify({
          message: 'getUrlForUpload: Error generating upload URL',
          fileName,
          error: error.message,
        }),
      );

      // Throw an HTTP exception with additional details
      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }
}
