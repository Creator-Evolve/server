import { ROLE } from '@/common/constants/roles.enum';
import { Roles } from '@/common/decorators/role.decorator';
import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppService } from './app.service';
import { v4 as uuidv4 } from 'uuid';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller('/')
@UseGuards(AuthGuard)
export class AppController {
  constructor(private appService: AppService) {}

  @Post('/upload')
  @Roles(ROLE.USER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadFIle(@UploadedFile() file: Express.Multer.File) {
    const modifiedFilename = `${uuidv4()}-${file.originalname}`;

    file.filename = modifiedFilename;
    return this.appService.uploadFile(file);
  }

  @Post('/url-for-upload')
  @Roles(ROLE.USER)
  async getUrlForUpload(@Body() body: { filename: string }) {
    return this.appService.getUrlForUpload(body.filename);
  }
}
