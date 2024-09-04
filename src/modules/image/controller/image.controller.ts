import { AuthGuard } from '@/common/guards/auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ImageService } from '../services/image.service';
import { GenerateImageDto } from '../dto/generate-text-to-image.dto';
import { GenerateImageToImageDto } from '../dto/generate-image-to-image.dto';
import { Request } from 'express';
import { InpaintImageDto } from '../dto/inpaint-image.dto';
import { EditImageDto } from '../dto/edit-image.dto';

@Controller('image')
@UseGuards(AuthGuard)
export class ImageController {
  constructor(private imageService: ImageService) {}

  @Get('/edits/:id')
  async getImageEdits(@Param('id') imageId: string) {
    return this.imageService.getImageEdits(imageId);
  }

  @Get('/all')
  async getImagesList(
    @Req() req: Request,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.imageService.getGeneratedImages(
      req.user.sub,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('/:id')
  async getImageById(@Param('id') imageId: string) {
    return this.imageService.getImageById(imageId);
  }

  @Post('/generate/text-to-image')
  async generateTextToImage(
    @Body() body: GenerateImageDto,
    @Req() req: Request,
  ) {
    return this.imageService.generateImage(body, req.user.sub);
  }

  @Post('/generate/image-to-image')
  async generateImageToImage(@Body() body: GenerateImageToImageDto) {
    return this.imageService.generateImageFromImage(body);
  }

  @Post('/edit/inpaint/:id')
  async editImage(@Body() body: InpaintImageDto, @Param('id') imageId: string) {
    return this.imageService.inpaintImage(body, imageId);
  }

  @Post('/edit/save/:id')
  async saveEditImage(@Body() body: EditImageDto, @Param('id') imageId: string) {
    return this.imageService.editImage(body, imageId);
  }

  @Post('/edit/remove-background/:id')
  async removeBackground(
    @Body() imageUrl: string,
    @Param('id') imageId: string,
  ) {
    return this.imageService.removeBackground(imageUrl, imageId);
  }

  @Delete('/:id')
  async deleteImageById(@Param('id') id: string) {
    return this.imageService.deleteImageById(id);
  }
}
