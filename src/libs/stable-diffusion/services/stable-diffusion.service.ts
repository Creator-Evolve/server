import { ConfigService } from '@/common/config/services/config.service';
import {
  IMAGE_ASPECT_RATIO,
  IMAGE_OUTPUT_FORMAT,
} from '@/common/constants/image.enum';
import { HttpService } from '@/common/http/services/http.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as FormData from 'form-data';
import { lastValueFrom } from 'rxjs';
import * as fs from 'node:fs';
import { Readable } from 'stream';

export enum STABILITY_SD3_MODEL {
  MEDIUM = 'sd3-medium',
  LARGE = 'sd3-large',
  TURBO = 'sd3-large-turbo',
}

@Injectable()
export class StableDiffusionService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private loggerService: LoggerService,
    private httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get('STABLE_DIFFUSION_API_URL');
    this.apiKey = this.configService.get('STABLE_DIFFUSION_API_KEY');
  }

  async generateTextToImageUltra(
    prompt: string,
    outputFormat: IMAGE_OUTPUT_FORMAT = IMAGE_OUTPUT_FORMAT.WEBP,
    negativePrompt: string,
    aspectRatio: IMAGE_ASPECT_RATIO = IMAGE_ASPECT_RATIO.WIDESCREEN,
  ): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', outputFormat);
    if (negativePrompt) {
      formData.append('negative_prompt', negativePrompt);
    }
    formData.append('aspect_ratio', aspectRatio);

    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'generateAndUploadImage -  Generating image with Stability AI',
          data: { prompt, outputFormat, negativePrompt, aspectRatio },
        }),
      );
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/stable-image/generate/ultra`,
          formData,
          {
            validateStatus: undefined,
            responseType: 'arraybuffer',
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: 'image/*',
            },
          },
        ),
      );

      if (response.status !== 200) {
        let errorMessage = `API request failed: ${response.status}`;
        let errorObject = {};
        if (response.data) {
          try {
            const errorBody = JSON.parse(Buffer.from(response.data).toString());
            errorMessage = errorBody.message || errorBody.error || errorMessage;
            errorObject = errorBody;
          } catch (parseError) {
            errorMessage = Buffer.from(response.data).toString();
          }
        }
        this.loggerService.error(
          `API Error: ${JSON.stringify(errorObject)}`,
          'StabilityAiService',
        );
        throw new HttpException(errorMessage, response.status);
      }

      const imageBuffer = Buffer.from(response.data);
      const fileName = `generated_image_${Date.now()}.${outputFormat}`;
      const mimetype = `image/${outputFormat}`;

      this.loggerService.log(
        'Uploading generated image to S3',
        'StabilityAiService',
      );
      const filePath = await this.storageService.upload(
        imageBuffer,
        fileName,
        mimetype,
      );

      this.loggerService.log(
        `Image uploaded successfully: ${filePath}`,
        'StabilityAiService',
      );
      return filePath;
    } catch (error: any) {
      this.loggerService.error(
        `Failed to generate or upload image: ${error.message}`,
        'StabilityAiService',
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to generate or upload image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateTextToImageSD3(
    prompt: string,
    outputFormat: IMAGE_OUTPUT_FORMAT = IMAGE_OUTPUT_FORMAT.PNG,
    negativePrompt: string,
    aspectRatio: IMAGE_ASPECT_RATIO = IMAGE_ASPECT_RATIO.WIDESCREEN,
    model: STABILITY_SD3_MODEL = STABILITY_SD3_MODEL.TURBO,
  ): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('model', model);
    formData.append('output_format', outputFormat);

    if (negativePrompt && model !== STABILITY_SD3_MODEL.TURBO) {
      // negative_prompt does not work with sd3-large-turbo.
      formData.append('negative_prompt', negativePrompt);
    }
    formData.append('aspect_ratio', aspectRatio);

    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'generateAndUploadImage -  Generating image with Stability AI',
          data: { prompt, outputFormat, negativePrompt, aspectRatio, model },
        }),
      );
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/stable-image/generate/sd3`,
          formData,
          {
            validateStatus: undefined,
            responseType: 'arraybuffer',
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: 'image/*',
            },
          },
        ),
      );

      if (response.status !== 200) {
        let errorMessage = `API request failed: ${response.status}`;
        let errorObject = {};
        if (response.data) {
          try {
            const errorBody = JSON.parse(Buffer.from(response.data).toString());
            errorMessage = errorBody.message || errorBody.error || errorMessage;
            errorObject = errorBody;
          } catch (parseError) {
            errorMessage = Buffer.from(response.data).toString();
          }
        }
        this.loggerService.error(
          `API Error: ${JSON.stringify(errorObject)}`,
          'StabilityAiService',
        );
        throw new HttpException(errorMessage, response.status);
      }

      const imageBuffer = Buffer.from(response.data);
      const fileName = `generated_image_${Date.now()}.${outputFormat}`;
      const mimetype = `image/${outputFormat}`;

      this.loggerService.log(
        'Uploading generated image to S3',
        'StabilityAiService',
      );
      const filePath = await this.storageService.upload(
        imageBuffer,
        fileName,
        mimetype,
      );

      this.loggerService.log(
        `Image uploaded successfully: ${filePath}`,
        'StabilityAiService',
      );
      return filePath;
    } catch (error: any) {
      this.loggerService.error(
        `Failed to generate or upload image: ${error.message}`,
        'StabilityAiService',
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to generate or upload image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateImageToImageSD3(
    prompt: string,
    imageUrl: string,
    outputFormat: IMAGE_OUTPUT_FORMAT = IMAGE_OUTPUT_FORMAT.PNG,
    negativePrompt: string,
    aspectRatio: IMAGE_ASPECT_RATIO = IMAGE_ASPECT_RATIO.WIDESCREEN,
    model: STABILITY_SD3_MODEL = STABILITY_SD3_MODEL.TURBO,
  ): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('mode', 'image-to-image');
    formData.append('model', model);
    formData.append('output_format', outputFormat);
    formData.append('strength', '0.7');

    // Download the image as a buffer
    const imageBuffer =
      await this.storageService.downloadImageAsBuffer(imageUrl);

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(imageBuffer);
    stream.push(null);

    // Append the stream to FormData
    formData.append('image', stream, {
      filename: 'image.png',
      contentType: 'image/png',
    });

    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'generateImageToImageSD3 - Generating image with Stability AI',
          data: { prompt, outputFormat, negativePrompt, aspectRatio, model },
        }),
      );

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/stable-image/generate/sd3`,
          formData,
          {
            validateStatus: (status) => true, // Allow all status codes
            responseType: 'arraybuffer',
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: 'image/*',
            },
          },
        ),
      );

      if (response.status !== 200) {
        let errorMessage = `API request failed: ${response.status}`;
        let errorObject = {};
        if (response.data) {
          try {
            const errorBody = JSON.parse(Buffer.from(response.data).toString());
            errorMessage = errorBody.message || errorBody.error || errorMessage;
            errorObject = errorBody;
          } catch (parseError) {
            errorMessage = Buffer.from(response.data).toString();
          }
        }
        this.loggerService.error(
          `API Error: ${JSON.stringify(errorObject)}`,
          'StabilityAiService',
        );
        throw new HttpException(errorMessage, response.status);
      }

      const responseImageBuffer = Buffer.from(response.data);
      const fileName = `generated_image_${Date.now()}.${outputFormat}`;
      const mimetype = `image/${outputFormat}`;

      this.loggerService.log(
        'generateImageToImageSD3: Uploading generated image to S3',
      );
      const filePath = await this.storageService.upload(
        responseImageBuffer,
        fileName,
        mimetype,
      );

      this.loggerService.log(
        `generateImageToImageSD3: Image uploaded successfully ${filePath}`,
      );
      return filePath;
    } catch (error: any) {
      this.loggerService.error(
        `generateImageToImageSD3: Failed to generate or upload image: ${error.message}`,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to generate or upload image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async editImage(
    prompt: string,
    imageUrl: string,
    maskUrl: string,
    outputFormat: IMAGE_OUTPUT_FORMAT = IMAGE_OUTPUT_FORMAT.PNG,
    negativePrompt?: string,
  ): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', outputFormat);

    if (negativePrompt) {
      formData.append('negative_prompt', negativePrompt);
    }

    // Download the image as a buffer
    const imageBuffer =
      await this.storageService.downloadImageAsBuffer(imageUrl);

    // Create a readable stream from the buffer
    const imageStream = new Readable();
    imageStream.push(imageBuffer);
    imageStream.push(null);

    // Append the image stream to FormData
    formData.append('image', imageStream, {
      filename: 'image.png',
      contentType: 'image/png',
    });

    // Download the mask as a buffer
    const maskBuffer = await this.storageService.downloadImageAsBuffer(maskUrl);

    // Create a readable stream from the buffer
    const maskStream = new Readable();
    maskStream.push(maskBuffer);
    maskStream.push(null);

    // Append the mask stream to FormData
    formData.append('mask', maskStream, {
      filename: 'mask.png',
      contentType: 'image/png',
    });

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'editImageSD3 - Editing image with Stability AI',
          data: { prompt, outputFormat },
        }),
      );

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/stable-image/edit/inpaint`,
          formData,
          {
            validateStatus: (status) => true, // Allow all status codes
            responseType: 'arraybuffer',
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: 'image/*',
            },
          },
        ),
      );

      if (response.status !== 200) {
        let errorMessage = `API request failed: ${response.status}`;
        let errorObject = {};
        if (response.data) {
          try {
            const errorBody = JSON.parse(Buffer.from(response.data).toString());
            errorMessage = errorBody.message || errorBody.error || errorMessage;
            errorObject = errorBody;
          } catch (parseError) {
            errorMessage = Buffer.from(response.data).toString();
          }
        }
        this.loggerService.error(
          `API Error: ${JSON.stringify(errorObject)}`,
          'StabilityAiService',
        );
        throw new HttpException(errorMessage, response.status);
      }

      const responseImageBuffer = Buffer.from(response.data);
      const fileName = `edited_image_${Date.now()}.${outputFormat}`;
      const mimetype = `image/${outputFormat}`;

      this.loggerService.log('editImageSD3: Uploading edited image to S3');
      const filePath = await this.storageService.upload(
        responseImageBuffer,
        fileName,
        mimetype,
      );

      this.loggerService.log(
        `editImageSD3: Image uploaded successfully ${filePath}`,
      );
      return filePath;
    } catch (error: any) {
      this.loggerService.error(
        `editImageSD3: Failed to edit or upload image: ${error.message}`,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to edit or upload image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeBackground(imageUrl: string, outputFormat: string) {
    try {
      this.loggerService.log(
        `removeBackground: Starting process for ${imageUrl}`,
        'StabilityAiService',
      );

      const formData = new FormData();

      // Download the image as a buffer
      this.loggerService.log(
        'removeBackground: Downloading image as buffer',
        'StabilityAiService',
      );
      const imageBuffer =
        await this.storageService.downloadImageAsBuffer(imageUrl);

      // Create a readable stream from the buffer
      const imageStream = new Readable();
      imageStream.push(imageBuffer);
      imageStream.push(null);

      // Append the image stream to FormData
      formData.append('image', imageStream, {
        filename: 'image.png',
        contentType: 'image/png',
      });

      this.loggerService.log(
        'removeBackground: Sending request to API',
        'StabilityAiService',
      );
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/stable-image/edit/remove-background`,
          formData,
          {
            validateStatus: (status) => true, // Allow all status codes
            responseType: 'arraybuffer',
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: 'image/*',
            },
          },
        ),
      );

      if (response.status !== 200) {
        let errorMessage = `API request failed: ${response.status}`;
        let errorObject = {};
        if (response.data) {
          try {
            const errorBody = JSON.parse(Buffer.from(response.data).toString());
            errorMessage = errorBody.message || errorBody.error || errorMessage;
            errorObject = errorBody;
          } catch (parseError) {
            errorMessage = Buffer.from(response.data).toString();
          }
        }
        this.loggerService.error(
          `removeBackground: API Error: ${JSON.stringify(errorObject)}`,
          'StabilityAiService',
        );
        throw new HttpException(errorMessage, response.status);
      }

      const responseImageBuffer = Buffer.from(response.data);
      const fileName = `edited_image_${Date.now()}.${outputFormat}`;
      const mimetype = `image/${outputFormat}`;

      this.loggerService.log(
        'removeBackground: Uploading edited image to S3',
        'StabilityAiService',
      );
      const filePath = await this.storageService.upload(
        responseImageBuffer,
        fileName,
        mimetype,
      );

      this.loggerService.log(
        `removeBackground: Image uploaded successfully ${filePath}`,
        'StabilityAiService',
      );
      return filePath;
    } catch (error:any) {
      this.loggerService.error(
        `removeBackground: Failed to edit or upload image: ${error.message}`,
        'StabilityAiService',
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to edit or upload image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
