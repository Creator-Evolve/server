import { ConfigService } from '@/common/config/services/config.service';
import { Injectable } from '@nestjs/common';
const Razorpay = require('razorpay');

@Injectable()
export class PaymentService {
  private readonly razorpay: any;
  constructor(private configService: ConfigService) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get('RAZORPAY_ID'),
      key_secret: this.configService.get('RAZORPAY_SECRET'),
    });
  }

  async createSession() {
    try {
    } catch (error) {}
  }


  async webhookHandler(){
    try {
      
    } catch (error) {
      
    }
  }
}
