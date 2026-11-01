import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';

const socialStrategyProviders: Provider[] = [
  {
    provide: GoogleStrategy,
    useFactory: (configService: ConfigService) => {
      if (
        !configService.get<string>('GOOGLE_CLIENT_ID') ||
        !configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        !configService.get<string>('GOOGLE_CALLBACK_URL')
      ) {
        return null;
      }
      return new GoogleStrategy(configService);
    },
    inject: [ConfigService],
  },
  {
    provide: FacebookStrategy,
    useFactory: (configService: ConfigService) => {
      const clientId =
        configService.get<string>('FACEBOOK_CLIENT_ID') ||
        configService.get<string>('FACEBOOK_APP_ID');
      const clientSecret =
        configService.get<string>('FACEBOOK_CLIENT_SECRET') ||
        configService.get<string>('FACEBOOK_APP_SECRET');
      if (!clientId || !clientSecret || !configService.get<string>('FACEBOOK_CALLBACK_URL')) {
        return null;
      }
      return new FacebookStrategy(configService);
    },
    inject: [ConfigService],
  },
];

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    GoogleAuthGuard,
    FacebookAuthGuard,
    ...socialStrategyProviders,
  ],
  exports: [AuthService],
})
export class AuthModule {}
