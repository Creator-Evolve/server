import { Module, OnModuleInit } from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '@/db/schemas/users/user.schema';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { CreditController } from './controllers/credit.controller';
import { CreditService } from './services/credit.service';
import {
  CreditAccount,
  CreditAccountSchema,
} from '@/db/schemas/users/credit/credit.schema';
import {
  CreditTransaction,
  CreditTransactionSchema,
  FEATURES,
} from '@/db/schemas/users/credit/credit.transaction.schema';
import {
  CreditPackage,
  CreditPackageSchema,
} from '@/db/schemas/users/credit/credit.package';
import { Model } from 'mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@/common/config/services/config.service';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      {
        name: CreditAccount.name,
        schema: CreditAccountSchema,
      },
      {
        name: CreditTransaction.name,
        schema: CreditTransactionSchema,
      },
      {
        name: CreditPackage.name,
        schema: CreditPackageSchema,
      },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    PaymentModule,
  ],
  controllers: [UserController, CreditController],
  providers: [UserService, CreditService],
  exports: [UserService],
})
export class UserModule implements OnModuleInit {
  constructor() {}
  async onModuleInit() {}
}
