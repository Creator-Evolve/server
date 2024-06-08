import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Module } from '@nestjs/common';
import { MailService } from './services/mail.service';
import { join } from 'path';
import { ConfigService } from '../config/services/config.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // use TLS
          auth: {
            user: configService.get('GMAIL_MAIL'),
            pass: configService.get('GMAIL_PASS'),
          },
        },
        defaults: {
          from: '"No Reply" <noreply@creatorevolve.com>',
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new PugAdapter(), // or new PugAdapter() or new EjsAdapter()
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService], // 👈 export for DI
})
export class MailModule {}
