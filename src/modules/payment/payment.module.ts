import { Module, OnModuleInit } from '@nestjs/common';
import { PaymentController } from './controllers/payment.controller';
import { PaymentService } from './services/payment.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CreditPackage,
  CreditPackageSchema,
} from '@/db/schemas/users/credit/credit.package';
import { PayPalService } from './services/paypal.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CreditPackage.name,
        schema: CreditPackageSchema,
      },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PayPalService],
  exports: [PayPalService],
})
export class PaymentModule implements OnModuleInit {
  constructor(private payPalService: PayPalService) {}
  async onModuleInit() {}
}
