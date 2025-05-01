import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreditService } from '../services/credit.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { Request } from 'express';

@Controller({
  path: 'credits',
  version: '1',
})
@UseGuards(AuthGuard)
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get('packages')
  async getCreditPackages() {
    return this.creditService.getCreditPackages();
  }

  @Post('packages/:id/buy')
  async buyCreditPackage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      plan: 'monthly' | 'yearly';
    },
  ) {
    return this.creditService.buyCreditPackage(req.user.sub, id, body.plan);
  }
}
