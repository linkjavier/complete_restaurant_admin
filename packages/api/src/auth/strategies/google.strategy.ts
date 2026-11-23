import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { SocialProfile } from './social-profile.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: SocialProfile) {
    const email = profile.emails?.[0];
    if (!email?.value || !(email.verified || profile._json?.email_verified)) {
      throw new UnauthorizedException('Google did not provide a verified email address');
    }

    return {
      email: email.value,
      firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || email.value,
      lastName: profile.name?.familyName || '',
      avatar: profile.photos?.[0]?.value,
    };
  }
}
