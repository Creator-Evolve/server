import { Module } from '@nestjs/common';
import { StableDiffusionService } from './services/stable-diffusion.service';
import { StorageModule } from '@/common/storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [StableDiffusionService],
  exports: [StableDiffusionService],
})
export class StableDiffusionModule {}
