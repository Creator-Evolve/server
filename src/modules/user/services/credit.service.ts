import { LoggerService } from '@/common/logger/services/logger.service';
import {
  CreditPackage,
  CreditPackageDocument,
} from '@/db/schemas/users/credit/credit.package';
import {
  CreditAccount,
  CreditAccountDocument,
} from '@/db/schemas/users/credit/credit.schema';
import {
  CreditTransaction,
  CreditTransactionDocument,
  TransactionStatus,
  TransactionType,
} from '@/db/schemas/users/credit/credit.transaction.schema';
import { User, UserDocument } from '@/db/schemas/users/user.schema';
import { PayPalService } from '@/modules/payment/services/paypal.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { SoftDeleteModel } from 'mongoose-delete';

@Injectable()
export class CreditService {
  constructor(
    @InjectModel(CreditAccount.name)
    private creditModel: Model<CreditAccountDocument>,
    @InjectModel(CreditTransaction.name)
    private creditTransactionModel: Model<CreditTransactionDocument>,
    @InjectModel(CreditPackage.name)
    private creditPackageModel: Model<CreditPackageDocument>,
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
    private paypalService: PayPalService,
    private loggerService: LoggerService,
  ) {}

  async getCreditPackages(): Promise<CreditPackageDocument[]> {
    return this.creditPackageModel.find().sort({ price: 1 });
  }

  async getCreditAccount(userId: string): Promise<CreditAccountDocument> {
    return this.creditModel.findOne({ user_id: userId });
  }

  async buyCreditPackage(
    userId: string,
    packageId: string,
    plan: 'monthly' | 'yearly',
  ): Promise<CreditTransactionDocument> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Attempting to buy credit package',
          data: { userId, packageId, plan },
        })
      );

      const creditPackage = await this.creditPackageModel.findById(packageId);
      const creditAccount = await this.creditModel.findOne({ user_id: userId });
      
      if (!creditPackage || !creditAccount) {
        this.loggerService.log(
          JSON.stringify({
            message: 'Invalid package or account',
            data: { userId, packageId },
          })
        );
        throw new Error('Invalid package or account');
      }
      if (!creditPackage.is_active) {
        this.loggerService.log(
          JSON.stringify({
            message: 'Package is not active',
            data: { packageId },
          })
        );
        throw new Error('Package is not active');
      }
      if (creditAccount.balance < creditPackage.price) {
        this.loggerService.log(
          JSON.stringify({
            message: 'Insufficient balance',
            data: { userId, balance: creditAccount.balance, price: creditPackage.price },
          })
        );
        throw new Error('Insufficient balance');
      }
      
      const transaction = new this.creditTransactionModel({
        user_id: userId,
        credit_account_id: creditAccount._id,
        amount: creditPackage.price,
        type: TransactionType.CREDIT,
        status: TransactionStatus.PENDING,
        description: `Purchase of ${creditPackage.name}`,
      });
      await transaction.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'Transaction saved successfully',
          data: { transactionId: transaction._id.toString() },
        })
      );

      const paypalUrl = await this.paypalService.createOrder(
        creditPackage,
        transaction._id.toString(),
      );

      creditAccount.package_history.push({
        package_id: creditPackage._id as ObjectId,
        purchased_at: new Date(),
        plan: plan,
      });

      await creditAccount.save();
      this.loggerService.log(
        JSON.stringify({
          message: 'Credit account updated successfully',
          data: { userId, packageId },
        })
      );

      return paypalUrl;
    } catch (error) {
      console.log(error);
      this.loggerService.error(error);
      throw new HttpException(
        JSON.stringify(error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async buyCredit(userId: string, credit: number) {}
}
