import { LoggerService } from '@/common/logger/services/logger.service';
import {
  OPEN_AI_CHAT_COMPLETION_MODEL,
  OpenAIService,
} from '@/libs/openai/services/openai.service';
import { StableDiffusionService } from '@/libs/stable-diffusion/services/stable-diffusion.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { GenerateImageDto } from '../dto/generate-text-to-image.dto';
import {
  IMAGE_GENERATION_MODEL,
  IMAGE_TYPE,
} from '@/common/constants/image.enum';
import { StorageService } from '@/common/storage/services/storage.service';
import { GenerateImageToImageDto } from '../dto/generate-image-to-image.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Image } from '@/db/schemas/media/image.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { InpaintImageDto } from '../dto/inpaint-image.dto';
import { EDIT_SERVICE, Inpaint } from '@/db/schemas/media/inpaint.schema';
import {
  modifyImageEditPrompt,
  optimizeImageGenerationPrompt,
} from '@/common/prompt';
import mongoose from 'mongoose';
import { EditImageDto } from '../dto/edit-image.dto';
import { dataURItoBuffer } from 'utils';

@Injectable()
export class ImageService {
  constructor(
    private stableDiffusionService: StableDiffusionService,
    private openAIService: OpenAIService,
    private loggerService: LoggerService,
    private storageService: StorageService,
    @InjectModel(Image.name) private imageModel: SoftDeleteModel<Image>,
    @InjectModel(Inpaint.name)
    private inpaintModel: SoftDeleteModel<Inpaint>,
  ) {}

  async getImageById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getImageById: Retrieving image',
          id,
        }),
      );
      const image = await this.imageModel.findById(id);
      
      const updatedEdits = image.edits.map((edit) => {
        const url = this.storageService.get(edit.url);
        return { url };
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'getImageById: Retrieved image successfully',
          id,
          updatedEdits,
          image: image.edits
        }),
      );

      return {
        ...image.toObject(),
        url: this.storageService.get(image.url),
        edits: updatedEdits,
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getImageById: Failed to retrieve image',
          id,
          error: error.message || error,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred while retrieving image',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getImageEdits(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getImageEdits: Retrieving image',
          id,
        }),
      );
      const image = await this.imageModel.findById(id).select('inpaints edits');
      this.loggerService.log(
        JSON.stringify({
          message: 'getImageEdits: Retrieved image successfully',
          id,
        }),
      );

      const imageEdits = await this.inpaintModel
        .find({
          _id: { $in: image.inpaints },
        })
        .sort({ _id: -1 });


      const updatedImageEdits = imageEdits.map((edit) => ({
        ...edit.toObject(),
        url: this.storageService.get(edit.url),
      }));

      return updatedImageEdits;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getImageEdits: Failed to retrieve image',
          id,
          error: error.message || error,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred while retrieving image',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getGeneratedImages(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getGeneratedImages: Starting to retrieve generated images',
          userId,
          page,
          limit,
        }),
      );

      const skip = (page - 1) * limit;

      const [images, total] = await Promise.all([
        this.imageModel
          .find({ user_id: userId })
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limit),
        this.imageModel.countDocuments({ user_id: userId }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const mappedImages = images.map((data) => ({
        ...data.toObject(),
        url: this.storageService.get(data.url),
      }));

      this.loggerService.log(
        JSON.stringify({
          message: 'getGeneratedImages: Retrieved images successfully',
          userId,
          page,
          limit,
          totalPages,
          totalImages: total,
        }),
      );

      return {
        images: mappedImages,
        pagination: {
          currentPage: page,
          totalPages,
          totalImages: total,
          imagesPerPage: limit,
        },
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getGeneratedImages: Failed to retrieve images',
          userId,
          page,
          limit,
          error: error.message || error,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred while retrieving generated images',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async generateImage(body: GenerateImageDto, userId: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'generateImage: Starting image generation',
          body,
        }),
      );

      let images: string[] = [];

      const {
        model,
        negative_prompt,
        number_of_images,
        output_format,
        prompt,
        quality,
        size,
        stability_aspect_ratio,
        style,
        enable_prompt_optimization,
      } = body;

      this.loggerService.log(
        JSON.stringify({
          message: 'generateImage: Extracted parameters from body',
          model,
          negative_prompt,
          number_of_images,
          output_format,
          prompt,
          quality,
          size,
          stability_aspect_ratio,
          style,
          enable_prompt_optimization,
        }),
      );

      if (model === IMAGE_GENERATION_MODEL.STABLE_DIFFUSION) {
        let finalPrompt = prompt;

        if (enable_prompt_optimization) {
          this.loggerService.log(
            JSON.stringify({
              message:
                'generateImage: Enabling prompt optimization for Stable Diffusion',
              prompt,
            }),
          );
          finalPrompt = await this.openAIService.chatCompletion({
            prompt: optimizeImageGenerationPrompt(prompt),
            model: OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_Mini,
          });
          this.loggerService.log(
            JSON.stringify({
              message: 'generateImage: Optimized prompt for Stable Diffusion',
              finalPrompt,
            }),
          );
        }

        const imagePromises = Array.from({ length: number_of_images }, () =>
          this.stableDiffusionService.generateTextToImageUltra(
            finalPrompt,
            output_format,
            negative_prompt,
            stability_aspect_ratio,
          ),
        );
        images = await Promise.all(imagePromises);
        this.loggerService.log(
          JSON.stringify({
            message: 'generateImage: Images generated using Stable Diffusion',
            images,
          }),
        );
      } else if (model === IMAGE_GENERATION_MODEL.STABLE_DIFFUSION_D3) {
        let finalPrompt = prompt;

        if (enable_prompt_optimization) {
          this.loggerService.log(
            JSON.stringify({
              message:
                'generateImage: Enabling prompt optimization for Stable Diffusion D3',
              prompt,
            }),
          );
          finalPrompt = await this.openAIService.chatCompletion({
            prompt: optimizeImageGenerationPrompt(prompt),
            model: OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_Mini,
          });
          this.loggerService.log(
            JSON.stringify({
              message:
                'generateImage: Optimized prompt for Stable Diffusion D3',
              finalPrompt,
            }),
          );
        }
        const imagePromises = Array.from({ length: number_of_images }, () =>
          this.stableDiffusionService.generateTextToImageSD3(
            finalPrompt,
            output_format,
            negative_prompt,
            stability_aspect_ratio,
          ),
        );
        images = await Promise.all(imagePromises);
        this.loggerService.log(
          JSON.stringify({
            message:
              'generateImage: Images generated using Stable Diffusion D3',
            images,
          }),
        );
      } else {
        let finalPrompt = prompt;
        if (!enable_prompt_optimization) {
          finalPrompt +=
            ' I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS';
        }
        this.loggerService.log(
          JSON.stringify({
            message: 'generateImage: Generating images using OpenAI service',
            finalPrompt,
          }),
        );
        images = await this.openAIService.generateImage(
          finalPrompt,
          size,
          number_of_images,
          quality,
          style,
        );
        this.loggerService.log(
          JSON.stringify({
            message: 'generateImage: Images generated using OpenAI service',
            images,
          }),
        );
      }

      const finalImages = [];
      for (let i = 0; i < number_of_images; i++) {
        const url = images[i];
        const title = await this.openAIService.chatCompletion({
          model: OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_Mini,
          prompt: `Generate a concise title (under 100 characters) for an image based on this prompt: "${prompt}". Provide only the title, without any additional text. just a plain text without any quotation.`,
          maxTokens: 50,
        });
        this.loggerService.log(
          JSON.stringify({
            message: 'generateImage: Generated title for image',
            title,
            url,
          }),
        );
        const image = new this.imageModel({
          prompt,
          negative_prompt,
          engine: model,
          aspect: stability_aspect_ratio,
          size,
          output_format,
          style,
          quality,
          url,
          type: IMAGE_TYPE.TEXT_TO_IMAGE,
          user_id: userId,
          name: title,
        });
        await image.save();
        this.loggerService.log(
          JSON.stringify({
            message: 'generateImage: Saved image to database',
            image,
          }),
        );

        finalImages.push(image.toObject());
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'generateImage: Successfully generated and saved images',
        }),
      );

      return finalImages.map((image) => ({
        ...image,
        url: this.storageService.get(image.url),
      }));
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'generateImage: Error occurred',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async generateImageFromImage(body: GenerateImageToImageDto) {
    try {
      const {
        image_url,
        model,
        negative_prompt,
        output_format,
        prompt,
        stability_aspect_ratio,
      } = body;

      let image: string;
      if (body.model === IMAGE_GENERATION_MODEL.STABLE_DIFFUSION_D3) {
        const response =
          await this.stableDiffusionService.generateImageToImageSD3(
            prompt,
            image_url,
            output_format,
            negative_prompt,
            stability_aspect_ratio,
          );
        image = this.storageService.get(response);
      } else {
        throw new HttpException(
          `Currently ${model} is not supported for generating image to image`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return image;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'generateImage: Error occurred',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async deleteImageById(id: string) {
    try {
      await this.imageModel.deleteById(id);
      return true;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteImageById: Error occurred',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async removeBackground(imageUrl: string, imageId: string) {
    try {
      this.loggerService.log(
        `removeBackground: Starting process for image ${imageId}`,
        'ImageService',
      );

      // Extract file extension
      this.loggerService.log(
        'removeBackground: Extracting file extension',
        'ImageService',
      );
      const extension =
        await this.storageService.extractFileNameFromPresignedUrl(imageUrl);

      // Remove background
      this.loggerService.log(
        'removeBackground: Calling Stable Diffusion service',
        'ImageService',
      );
      const processedImageUrl =
        await this.stableDiffusionService.removeBackground(imageUrl, extension);

      // Create new image edit record
      this.loggerService.log(
        'removeBackground: Creating image edit record',
        'ImageService',
      );
      const imageEdit = new this.inpaintModel({
        engine: IMAGE_GENERATION_MODEL.STABLE_DIFFUSION,
        image_id: imageId,
        url: processedImageUrl,
        service: EDIT_SERVICE.REMOVE_BACKGROUD,
      });

      // Save image edit
      this.loggerService.log(
        'removeBackground: Saving image edit',
        'ImageService',
      );
      await imageEdit.save();

      await this.imageModel.findByIdAndUpdate(imageId, {
        $push: { edits: imageEdit._id },
      });

      this.loggerService.log(
        `removeBackground: Process completed successfully for image ${imageId}`,
        'ImageService',
      );
      return this.storageService.get(processedImageUrl);
    } catch (error: any) {
      this.loggerService.error(
        `removeBackground: Failed to process image ${imageId}: ${error.message}`,
        error.stack,
        'ImageService',
      );

      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException(
          'Failed to remove background from image',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async inpaintImage(body: InpaintImageDto, imageId: string) {
    const {
      mask_url,
      model,
      negative_prompt,
      output_format,
      prompt,
      image_url,
      enable_prompt_optimization,
    } = body;

    this.loggerService.log(
      JSON.stringify({
        message: 'editImage: Function called',
        body,
        imageId,
      }),
    );

    if (!imageId)
      throw new HttpException('Please provide image Id', HttpStatus.NOT_FOUND);

    try {
      let finalPrompt = prompt;
      if (enable_prompt_optimization) {
        const masterPrompt = modifyImageEditPrompt(prompt);
        this.loggerService.log(
          JSON.stringify({
            message: 'editImage: Master prompt created',
            masterPrompt,
          }),
        );

        finalPrompt = await this.openAIService.chatCompletion({
          prompt: masterPrompt,
          maxTokens: prompt.length + 500,
          model: OPEN_AI_CHAT_COMPLETION_MODEL.GPT_4o_Mini,
          imageUrl: image_url,
        });

        this.loggerService.log(
          JSON.stringify({
            message: 'editImage: Final prompt is ready',
            finalPrompt,
          }),
        );
      }

      const maskUrl = this.storageService.get(mask_url);
      this.loggerService.log(
        JSON.stringify({
          message: 'editImage: Mask URL retrieved',
          maskUrl,
        }),
      );

      let resp;
      if (model === IMAGE_GENERATION_MODEL.STABLE_DIFFUSION) {
        this.loggerService.log('editImage: Using Stable Diffusion model');
        this.loggerService.log('editImage: Calling Stable Diffusion service');
        resp = await this.stableDiffusionService.editImage(
          finalPrompt,
          image_url,
          maskUrl,
          output_format,
          negative_prompt,
        );
      } else if (model === IMAGE_GENERATION_MODEL.DALLE) {
        this.loggerService.log('editImage: Using DALL-E model');
        this.loggerService.log('editImage: Calling OpenAI service for DALL-E');
        resp = await this.openAIService.editImage(
          image_url,
          maskUrl,
          finalPrompt,
        );
      } else {
        this.loggerService.error(
          JSON.stringify({
            message: 'editImage: Invalid model',
            model,
          }),
        );
        throw new HttpException('Invalid model', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: `editImage: ${model} service response received`,
          resp,
        }),
      );

      const imageEdit = new this.inpaintModel({
        engine: model,
        prompt,
        negative_prompt,
        mask_url,
        output_format,
        image_id: imageId,
        url: resp,
        optimized_prompt: finalPrompt,
      });

      this.loggerService.log('editImage: Saving image edit');
      await imageEdit.save();

      this.loggerService.log('editImage: Updating image model');
      await this.imageModel.findByIdAndUpdate(imageId, {
        $push: { inpaints: imageEdit._id },
      });

      const result = this.storageService.get(resp);
      this.loggerService.log(
        JSON.stringify({
          message: 'editImage: Function completed successfully',
          result,
        }),
      );

      return result;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'editImage: Error occurred',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async editImage(body: EditImageDto, imageId: string) {
    try {
      // Log the start of the image editing process
      this.loggerService.log(
        JSON.stringify({
          message: 'editImage: Start editing image',
          imageId,
        }),
      );

      const image = await this.imageModel.findById(imageId);

      if (!image) {
        this.loggerService.log(
          JSON.stringify({
            message: 'editImage: Image not found',
            imageId,
          }),
        );
        throw new Error('Image not found');
      }

      const { s3_url } = body;

      await image.updateOne({ $push: { edits: { url: s3_url } } });

      // Log the successful save of the image document
      this.loggerService.log(
        JSON.stringify({
          message: 'editImage: Successfully saved edited image',
          imageId,
          s3_url,
        }),
      );

      return 'success';
    } catch (error: any) {
      // Log any errors that occur during the process
      this.loggerService.log(
        JSON.stringify({
          message: 'editImage: Error editing image',
          imageId,
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Error occurred',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
