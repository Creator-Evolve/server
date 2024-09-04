import { Module } from '@nestjs/common';
import { ClaudeService } from './services/claude.service';
import { StorageModule } from '@/common/storage/storage.module';

@Module({
  imports: [StorageModule],
  exports: [ClaudeService],
  providers: [ClaudeService],
})
export class ClaudeModule {}
