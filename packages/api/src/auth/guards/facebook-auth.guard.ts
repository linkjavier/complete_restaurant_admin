import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookAuthGuard extends AuthGuard('facebook') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const state = typeof request.query.state === 'string' ? request.query.state : null;

    if (typeof request.query.error === 'string' && state) {
      if (await this.redirectToLogin(state, response)) return true;
      return super.canActivate(context) as Promise<boolean>;
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      if (state && (await this.redirectToLogin(state, response))) return true;
      throw error;
    }
  }

  private async redirectToLogin(state: string, response: Response): Promise<boolean> {
    let oauthState;
    try {
      oauthState = await this.authService.verifySocialOAuthState(state, 'facebook');
    } catch {
      return false;
    }
    const loginUrl = new URL('/auth/login', oauthState.returnTo);
    loginUrl.searchParams.set('socialError', 'facebook');
    response.redirect(loginUrl.toString());
    return true;
  }
}
