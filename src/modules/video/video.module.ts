import { Module } from '@nestjs/common';
import { VideoController } from './controller/video.controller';
import { VideoService } from './services/video.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from '@/db/schemas/media/video.schema';
import { TwelveLabsModule } from '@/libs/twelvelabs/twelvelabs.module';
import { User, UserSchema } from '@/db/schemas/users/user.schema';
import { TLIndex, TLIndexSchema } from '@/db/schemas/services/tl.index.schema';
import { UserModule } from '@/modules/user/user.module';
import { JwtService } from '@nestjs/jwt';
import { StorageModule } from '@/common/storage/storage.module';
import { VideoProcessorService } from './services/processor.service';
import { OpenAIModule } from '@/libs/openai/openai.module';
import { ClaudeModule } from '@/libs/claude/claude.module';
import { VideoShort, VideoShortSchema } from '@/db/schemas/media/short.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Video.name, schema: VideoSchema },
      { name: User.name, schema: UserSchema },
      { name: TLIndex.name, schema: TLIndexSchema },
      { name: VideoShort.name, schema: VideoShortSchema },
    ]),
    TwelveLabsModule,
    UserModule,
    StorageModule,
    OpenAIModule,
    ClaudeModule,
  ],
  controllers: [VideoController],
  providers: [VideoService, JwtService, VideoProcessorService],
  exports: [VideoService],
})
export class VideoModule {}
