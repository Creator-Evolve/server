import { ConfigService } from '@/common/config/services/config.service';
import { HttpService } from '@/common/http/services/http.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import {
  CreditPackage,
  CreditPackageDocument,
} from '@/db/schemas/users/credit/credit.package';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import * as qs from 'qs';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class PayPalService {
  private access_token: string;
  private access_token_expires: number;
  private clientUrl: string;

  constructor(
    @InjectModel(CreditPackage.name)
    private creditPackageModel: Model<CreditPackageDocument>,
    private configService: ConfigService,
    private httpService: HttpService,
    private loggerService: LoggerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // this.clientUrl = this.configService.get('PAYPAL_CLIENT_URL');
    // this.initializeAccessToken();
  }

  private async initializeAccessToken() {
    const cachedToken = await this.cacheManager.get('paypal_access_token');
    if (cachedToken) {
      this.access_token = cachedToken as string;
    } else {
      this.access_token = await this.getAccessToken();
    }
  }

  private async checkAccessToken() {
    const cachedToken = await this.cacheManager.get('paypal_access_token');
    if (!cachedToken) {
      const newToken = await this.getAccessToken();
      return newToken;
    }
    return cachedToken as string;
  }

  async getAccessToken() {
    try {
      const clientId = this.configService.get('PAYPAL_CLIENT_ID');
      const clientSecret = this.configService.get('PAYPAL_CLIENT_SECRET');
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );

      const data = qs.stringify({
        grant_type: 'client_credentials',
      });

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.configService.get('PAYPAL_CLIENT_URL')}/oauth2/token`,
          data,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${auth}`,
            },
          },
        ),
      );

      const NINE_HOURS = 32400;

      // Store token in Redis cache
      await this.cacheManager.set(
        'paypal_access_token',
        response.data.access_token,
        NINE_HOURS, // TTL in seconds
      );

      return response.data.access_token;
    } catch (error) {
      this.loggerService.error(error);
      throw error;
    }
  }

  // Create a webhook to handle the subscription
  async createWebhook() {
    try {
      const response = await lastValueFrom(
        this.httpService.post(`${this.clientUrl}/webhooks`, {
          url: 'https://example.com/webhook',
        }),
      );
    } catch (error) {}
  }

  async createOrder(pack: CreditPackageDocument, transactionId: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Creating PayPal order',
          data: {
            packageName: pack.name,
            transactionId,
            price: pack.price.toFixed(2),
          },
        }),
      );

      // send request to paypal to create order
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.clientUrl}/checkout/orders`,
          {
            intent: 'CAPTURE',
            payment_source: {
              paypal: {
                experience_context: {
                  payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                  landing_page: 'LOGIN',
                  shipping_preference: 'NO_SHIPPING',
                  user_action: 'PAY_NOW',
                  return_url: `${this.configService.get('APP_URL')}/complete-order/${transactionId}`,
                  cancel_url: `${this.configService.get('APP_URL')}/cancel-order/${transactionId}`,
                  brand_name: 'creatorevolve.com'
                }
              }
            },
            purchase_units: [
              {
                items: [
                  {
                    name: pack.name,
                    quantity: '1',
                    unit_amount: {
                      value: pack.price.toFixed(2),
                      currency_code: 'USD',
                    },
                    description: `${pack.credits} Credits Package`,
                    category: 'DIGITAL_GOODS'
                  },
                ],
                amount: {
                  currency_code: 'USD',
                  value: pack.price.toFixed(2),
                  breakdown: {
                    item_total: {
                      currency_code: 'USD',
                      value: pack.price.toFixed(2),
                    },
                  },
                },
              },
            ]
          },
          {
            headers: {
              Authorization: `Bearer ${await this.checkAccessToken()}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'PayPal-Request-Id': `ORDER-${pack._id}-${Date.now()}`,
              Prefer: 'return=representation',
            },
          },
        ),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'PayPal order created successfully',
          data: {
            orderLink: response.data.links.find(
              (link: any) => link.rel === 'approve',
            ).href,
          },
        }),
      );

      return response.data.links.find((link: any) => link.rel === 'approve')
        .href;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: 'PayPal order creation failed',
          data: {
            error: error.response?.data || error.message,
            status: error.response?.status,
          },
        }),
      );
      throw error;
    }
  }

  private async createProduct(pack: CreditPackageDocument) {
    try {
      const productPayload = {
        name: `${pack.name}-v1`,
        description: `${pack.credits} Credits Package`,
        type: 'SERVICE',
        category: 'SOFTWARE',
        image_url: 'https://example.com/credits.jpg', // You can update this with your actual image URL
      };

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.clientUrl}/catalogs/products`,
          productPayload,
          {
            headers: {
              Authorization: `Bearer ${await this.checkAccessToken()}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'PayPal-Request-Id': `PRODUCT-${pack._id}-${Date.now()}`,
              Prefer: 'return=representation',
            },
          },
        ),
      );

      await this.creditPackageModel.findByIdAndUpdate(pack._id, {
        paypal_product_id: response.data.id,
      });
      return response.data.id;
    } catch (error: any) {
      this.loggerService.error('Error creating PayPal product:', error);
      throw error;
    }
  }

  async createPlanFromDBPackages() {
    try {
      // set paypal_product_id to null
      await this.creditPackageModel.updateMany(
        {},
        { paypal_product_id: null, paypal_plan_id: null },
      );

      const packages = await this.creditPackageModel.find({ is_active: true });
      for (const pack of packages) {
        // Skip if plan already exists
        if (pack.paypal_plan_id) {
          continue;
        }

        // Create product first
        const productId = await this.createProduct(pack);

        const payload = {
          product_id: productId,
          name: pack.name,
          description: `${pack.credits} Credits Package`,
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: {
                interval_unit: 'MONTH',
                interval_count: 1,
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 12,
              pricing_scheme: {
                fixed_price: {
                  value: pack.price.toFixed(2),
                  currency_code: 'USD',
                },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: {
              value: '0',
              currency_code: 'USD',
            },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3,
          },
          taxes: {
            percentage: '18',
            inclusive: false,
          },
        };

        const response = await lastValueFrom(
          this.httpService.post(`${this.clientUrl}/billing/plans`, payload, {
            headers: {
              Authorization: `Bearer ${await this.checkAccessToken()}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'PayPal-Request-Id': `PLAN-${productId}-${Date.now()}`,
              Prefer: 'return=representation',
            },
          }),
        );

        // Store the plan ID in the package document
        await this.creditPackageModel.findByIdAndUpdate(pack._id, {
          paypal_plan_id: response.data.id,
        });

        this.loggerService.log(
          `Created PayPal plan ${response.data.id} for package ${pack.name}`,
        );
      }
    } catch (error: any) {
      this.loggerService.error('Error in createPlanFromDBPackages:', error);
      throw error;
    }
  }
}
