import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@/common/config/services/config.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { extractExtension } from 'utils';
import { LoggerService } from '@/common/logger/services/logger.service';

export enum ANTHROPIC_MODEL {
  CLAUDE_3_7_SONNET = 'claude-3-7-sonnet',
  CLAUDE_SONNET_3_POINT_5 = 'claude-3-5-sonnet-20240620',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
}

@Injectable()
export class ClaudeService {
  private client: Anthropic;
  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private loggerService: LoggerService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY'),
    });
  }

  async chatCompletion({
    model = ANTHROPIC_MODEL.CLAUDE_SONNET_3_POINT_5,
    prompt,
    temperature = 0.7,
    max_tokens = 4096,
    imageUrl,
  }: {
    prompt: string;
    temperature?: number;
    model?: ANTHROPIC_MODEL;
    max_tokens?: number;
    imageUrl?: string;
  }): Promise<string> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: `chatCompletion: Start processing`,
          data: { model, prompt, temperature, max_tokens, imageUrl },
        }),
      );

      let messages = [];

      if (imageUrl) {
        this.loggerService.log(
          JSON.stringify({
            message: `chatCompletion: Downloading image from URL`,
            data: { imageUrl },
          }),
        );

        const imageBuffer =
          await this.storageService.downloadImageAsBuffer(imageUrl);

        const extention = extractExtension(imageUrl);
        const media_type = `image/${extention}`;

        this.loggerService.log(
          JSON.stringify({
            message: `chatCompletion: Image downloaded and converted to buffer`,
            data: { extention, media_type },
          }),
        );

        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                data: imageBuffer,
                media_type,
              },
            },
          ],
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      this.loggerService.log(
        JSON.stringify({
          message: `chatCompletion: Sending message to AI model`,
          data: { model, messages, max_tokens, temperature },
        }),
      );

      const msg: any = await this.client.messages.create({
        model,
        messages,
        max_tokens,
        temperature,
      });

      this.loggerService.log(
        JSON.stringify({
          message: `chatCompletion: Received response from AI model`,
          data: { content: msg.content },
        }),
      );

      return msg.content[0].text;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: `chatCompletion: Error occurred`,
          data: { error: error.message },
        }),
      );
      throw error;
    }
  }
}
