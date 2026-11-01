import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { SocialProfile } from './social-profile.interface';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(configService: ConfigService) {
    super({
      clientID:
        configService.get<string>('FACEBOOK_CLIENT_ID') ||
        configService.get<string>('FACEBOOK_APP_ID'),
      clientSecret:
        configService.get<string>('FACEBOOK_CLIENT_SECRET') ||
        configService.get<string>('FACEBOOK_APP_SECRET'),
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL'),
      profileFields: ['id', 'emails', 'name', 'picture'],
      scope: ['email', 'public_profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: SocialProfile) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException(
        'Facebook did not provide an email address. Allow the email permission and try again.',
      );
    }

    const nameParts = profile.displayName?.trim().split(/\s+/) ?? [];
    return {
      email,
      firstName: profile.name?.givenName || nameParts[0] || email,
      lastName: profile.name?.familyName || nameParts.slice(1).join(' '),
      avatar: profile.photos?.[0]?.value,
    };
  }
}
