import { AuthGuard } from '@/common/guards/auth.guard';
import { Controller, UseGuards } from '@nestjs/common';

@Controller('media/video/subtitle')
@UseGuards(AuthGuard)
export class SubtitleController {
    
}
