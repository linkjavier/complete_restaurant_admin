// packages/api/auth/local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super(); // por defecto espera username y password
  }

  async validate(username: string, password: string, done: Function) {
    const request = arguments[2];
    const tenantId = request.body.tenantId;
    const user = await this.authService.validateUser(username, password, tenantId);
    if (!user) {
      return done(new UnauthorizedException('Invalid credentials'), false);
    }
    return done(null, user);
  }
}
