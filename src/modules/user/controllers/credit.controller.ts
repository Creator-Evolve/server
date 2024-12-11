import { Body, Controller, Post } from '@nestjs/common';
import { CreditService } from '../services/credit.service';

@Controller({
  path: 'credits',
  version: '1',
})

export class CreditController {
  constructor(private readonly creditService: CreditService) {} 
  
}
