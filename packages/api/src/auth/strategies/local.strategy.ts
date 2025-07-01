import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string, done: Function) {
    const request = arguments[2];
    const tenantId = request.body.tenantId;
    const user = await this.authService.validateUser(email, password, tenantId);
    if (!user) {
      return done(new UnauthorizedException(), false);
    }
    return done(null, user);
  }
} 