import { Module } from '@nestjs/common';
import { ImageController } from './controller/image.controller';
import { ImageService } from './services/image.service';
import { StableDiffusionModule } from '@/libs/stable-diffusion/stable-diffusion.module';
import { JwtService } from '@nestjs/jwt';
import { OpenAIModule } from '@/libs/openai/openai.module';
import { StorageModule } from '@/common/storage/storage.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Image, ImageSchema } from '@/db/schemas/media/image.schema';
import { Inpaint, InpaintSchema } from '@/db/schemas/media/inpaint.schema';

@Module({
  imports: [
    StableDiffusionModule,
    OpenAIModule,
    StorageModule,
    MongooseModule.forFeature([
      {
        name: Image.name,
        schema: ImageSchema,
      },
      {
        name: Inpaint.name,
        schema: InpaintSchema,
      },
    ]),
  ],
  controllers: [ImageController],
  providers: [ImageService, JwtService],
})
export class ImageModule {}
