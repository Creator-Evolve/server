import { Module } from '@nestjs/common';
import { OpenAIService } from './services/openai.service';
import { StorageModule } from '@/common/storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
