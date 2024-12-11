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
} from '@/db/schemas/users/credit/credit.transaction.schema';
import { User, UserDocument } from '@/db/schemas/users/user.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  ) {}

  async getCreditPackages(): Promise<CreditPackageDocument[]> {
    return this.creditPackageModel.find();
  }

  async getCreditAccount(userId: string): Promise<CreditAccountDocument> {
    return this.creditModel.findOne({ user_id: userId });
  }

  async buyCreditPackage(
    userId: string,
    packageId: string,
  ): Promise<CreditTransactionDocument> {
    try {
      const creditPackage = await this.creditPackageModel.findById(packageId);
      const creditAccount = await this.creditModel.findOne({ user_id: userId });
      if (!creditPackage || !creditAccount) {
        throw new Error('Invalid package or account');
      }
      if (!creditPackage.is_active) {
        throw new Error('Package is not active');
      }
      if (creditAccount.balance < creditPackage.price) {
        throw new Error('Insufficient balance');
      }
      const transaction = new this.creditTransactionModel({
        user_id: userId,
        credit_account_id: creditAccount._id,
        amount: creditPackage.price,
        type: 'DEBIT',
        status: 'PENDING',
        description: `Purchase of ${creditPackage.name}`,
      });
      await transaction.save();
      creditAccount.balance -= creditPackage.price;
      await creditAccount.save();
      return transaction;
    } catch (error) {
      throw new HttpException(
        JSON.stringify(error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
