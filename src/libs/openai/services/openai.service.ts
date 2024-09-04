import { ConfigService } from '@/common/config/services/config.service';
import {
  IMAGE_EDIT_PARAM,
  IMAGE_QUALITY,
  IMAGE_SIZE,
  IMAGE_STYLE,
} from '@/common/constants/image.enum';
import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';
import OpenAI from 'openai';
import { TranscriptionCreateParams } from 'openai/resources/audio/transcriptions';

export enum CHAT_COMPLETION_RESPONSE_FORMAT {
  TEXT = 'text',
  JSON_OBJECT = 'json_object',
}

export enum TRANSCRIPTION_RESPONSE_FORMAT {
  SRT = 'srt',
  JSON = 'json',
  TEXT = 'text',
  VTT = 'vtt',
  VERBOSE_JSON = 'verbose_json',
}

export enum OPEN_AI_CHAT_COMPLETION_MODEL {
  GPT_3_5_Turbo = 'gpt-3.5-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_32k = 'gpt-4-32k',
  GPT_4o = 'gpt-4o',
  GPT_4o_2024_08_06 = 'gpt-4o-2024-08-06', // cheaper than gpt-4o
  GPT_4o_Mini = 'gpt-4o-mini',
}

export enum OPEN_AI_IMAGE_GENERATION_MODEL {
  DALLE_3 = 'dall-e-3',
  DALLE_2 = 'dall-e-2',
}

@Injectable()
export class OpenAIService {
  private client: OpenAI;
  constructor(
    private configService: ConfigService,
    private loggerService: LoggerService,
    private storageService: StorageService,
  ) {
    this.client = new OpenAI({
      apiKey: this.configService.get('OPEN_AI_API_KEY'),
    });
  }

  async chatCompletion({
    prompt,
    responseFormat = CHAT_COMPLETION_RESPONSE_FORMAT.TEXT,
    model,
    temperature = 0.7,
    maxTokens,
    imageUrl,
  }: {
    prompt: string;
    responseFormat?: CHAT_COMPLETION_RESPONSE_FORMAT;
    temperature?: number;
    model?: OPEN_AI_CHAT_COMPLETION_MODEL;
    maxTokens?: number;
    imageUrl?: string;
  }) {
    try {
      this.loggerService.log(
        `chatCompletion: Generating Response for prompt: ${prompt}  `,
      );

      let messages = [];

      if (imageUrl) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const response = await this.client.chat.completions.create({
        messages,
        model: model ?? OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_2024_08_06,
        response_format: { type: responseFormat },
        temperature,
        max_tokens: maxTokens,
      });

      this.loggerService.log(
        `chatCompletion: Generated Response for prompt: ${response.choices[0].message.content} ,Total Token usage: ${response.usage.total_tokens} `,
      );
      return response.choices[0].message.content;
    } catch (error: any) {
      throw new Error(JSON.stringify(error));
    }
  }

  async transcribe({
    filePath,
    response_format = TRANSCRIPTION_RESPONSE_FORMAT.TEXT,
    timestamp_granularities,
  }: {
    filePath: string;
    response_format: TRANSCRIPTION_RESPONSE_FORMAT;
    timestamp_granularities?: 'word' | 'segment';
  }) {
    try {
      if (!filePath) {
        throw new Error('File path must be provided.');
      }

      this.loggerService.log(
        `transcribe: Starting transcription for file: ${filePath}`,
      );

      const fileBuffer = createReadStream(filePath);

      const option: TranscriptionCreateParams = {
        file: fileBuffer,
        model: 'whisper-1',
        response_format,
        timestamp_granularities: [timestamp_granularities],
      };

      if (
        response_format !== TRANSCRIPTION_RESPONSE_FORMAT.VERBOSE_JSON &&
        timestamp_granularities
      ) {
        // timestamp_granularities only supported on verbose_json response
        delete option.timestamp_granularities;
      }

      const response = await this.client.audio.transcriptions.create(option);

      this.loggerService.log({
        message: `transcribeVideo: Transcription result: ${response}  `,
        data: response,
      });
      return response;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: `transcribe: Error Occured`,
          error,
        }),
      );

      throw new Error(error.message);
    }
  }

  async generateImage(
    prompt: string,
    size: IMAGE_SIZE,
    numberOfImages: number = 1,
    quality: IMAGE_QUALITY = IMAGE_QUALITY.HD,
    style: IMAGE_STYLE = IMAGE_STYLE.VIVID,
  ): Promise<string[]> {
    try {
      this.loggerService.log({
        message: `generateImage: Starting image generation with prompt: ${prompt}`,
        data: { prompt, size, numberOfImages },
      });

      const response = await this.client.images.generate({
        prompt,
        model: OPEN_AI_IMAGE_GENERATION_MODEL.DALLE_3,
        n: numberOfImages,
        size,
        quality,
        style,
        response_format: 'b64_json',
      });

      this.loggerService.log({
        message: 'generateImage: Image generation successful',
      });

      // Upload images to S3 and return their URLs
      const imageUploadPromises = response.data.map(async (image, index) => {
        const buffer = Buffer.from(image.b64_json, 'base64');
        const filename = `image-${index + 1}.png`; // Assuming the images are PNG format
        const mimetype = 'image/png';

        const filePath = await this.storageService.upload(
          buffer,
          filename,
          mimetype,
        );
        return filePath;
      });

      const imageUrls = await Promise.all(imageUploadPromises);

      return imageUrls;
    } catch (error: any) {
      this.loggerService.error({
        message: 'generateImage: Error generating image',
        data: error,
      });
      throw new Error(error.message);
    }
  }

  async editImage(
    imagePath: string,
    maskPath: string,
    prompt: string,
    size?: IMAGE_EDIT_PARAM,
    numberOfImages: number = 1,
  ): Promise<string[]> {
    try {
      this.loggerService.log({
        message: `editImage: Starting image edit with prompt: ${prompt}`,
        data: { imagePath, maskPath, prompt, size, numberOfImages },
      });

      const response = await this.client.images.edit({
        model: OPEN_AI_IMAGE_GENERATION_MODEL.DALLE_2,
        image: createReadStream(imagePath),
        mask: createReadStream(maskPath),
        prompt,
        n: numberOfImages,
        response_format: 'b64_json',
      });

      this.loggerService.log({
        message: 'editImage: Image editing successful',
        data: response,
      });

      // Upload edited images to S3 and return their URLs
      const imageUploadPromises = response.data.map(async (image, index) => {
        const buffer = Buffer.from(image.b64_json, 'base64');
        const filename = `edited-image-${index + 1}.png`; // Assuming the images are PNG format
        const mimetype = 'image/png';

        const filePath = await this.storageService.upload(
          buffer,
          filename,
          mimetype,
        );
        return filePath;
      });

      const imageUrls = await Promise.all(imageUploadPromises);

      return imageUrls;
    } catch (error: any) {
      this.loggerService.error({
        message: 'editImage: Error editing image',
        data: error,
      });
      throw new Error(error.message);
    }
  }
}
