import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  ConflictException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginResponse } from './types/auth.types';
import { SocialLoginOutcome, SocialProvider } from './auth.service';

interface SocialLoginProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

interface RequestWithUser extends Request {
  user?: SocialLoginProfile;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful', 
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string' },
            locationId: { type: 'string', nullable: true },
            location: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })

  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Req() req: any): Promise<LoginResponse> {
    return this.authService.login(req.user);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string' },
            locationId: { type: 'string', nullable: true },
            location: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request & { tenantId?: string }) {
    return this.authService.register(registerDto, req.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: any) {
    return req.user;
  }

  @Get('google')
  @ApiOperation({ summary: 'Start Google OAuth login' })
  async googleLogin(
    @Req() req: Request & { tenantId?: string },
    @Query('returnTo') returnTo: string,
    @Query('nonce') nonce: string,
    @Query('flow') flow: string,
    @Query('tenantName') tenantName: string,
    @Res() res: Response,
  ) {
    const url = await this.authService.createSocialAuthorizationUrl(
      'google',
      req.tenantId,
      returnTo,
      nonce,
      flow === 'register',
      tenantName,
    );
    return res.redirect(url);
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: RequestWithUser,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!req.user) return;
    return this.finishSocialLogin('google', req.user, state, res);
  }

  @Get('facebook')
  @ApiOperation({ summary: 'Start Facebook OAuth login' })
  async facebookAuth(
    @Req() req: Request & { tenantId?: string },
    @Query('returnTo') returnTo: string,
    @Query('nonce') nonce: string,
    @Query('flow') flow: string,
    @Query('tenantName') tenantName: string,
    @Res() res: Response,
  ) {
    const url = await this.authService.createSocialAuthorizationUrl(
      'facebook',
      req.tenantId,
      returnTo,
      nonce,
      flow === 'register',
      tenantName,
    );
    return res.redirect(url);
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  async facebookAuthCallback(
    @Req() req: RequestWithUser,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!req.user) return;
    return this.finishSocialLogin('facebook', req.user, state, res);
  }

  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange one-time social login code for a session' })
  async exchangeSocialLoginCode(@Body('code') code: string): Promise<LoginResponse> {
    if (typeof code !== 'string') {
      throw new BadRequestException('A social login code is required');
    }
    return this.authService.exchangeSocialLoginTicket(code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Returns the current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Req() req: any) {
    return req.user;
  }

  private async finishSocialLogin(
    provider: SocialProvider,
    profile: SocialLoginProfile,
    state: string,
    res: Response,
  ) {
    const oauthState = await this.authService.verifySocialOAuthState(state, provider);
    let callbackUrl = new URL('/auth/oauth/callback', oauthState.returnTo);
    let outcome: SocialLoginOutcome;
    try {
      outcome = await this.authService.finishSocialLogin(profile, oauthState);
    } catch (error) {
      if (error instanceof ConflictException && oauthState.mode === 'business-registration') {
        callbackUrl.searchParams.set('status', 'business_exists');
        return res.redirect(callbackUrl.toString());
      }
      throw error;
    }
    if (outcome.status === 'pending') {
      callbackUrl.searchParams.set('nonce', oauthState.nonce);
      callbackUrl.searchParams.set('status', outcome.status);
      return res.redirect(callbackUrl.toString());
    }

    const user = outcome.user;
    if (outcome.status === 'business-created') {
      const tenantUrl = new URL(oauthState.returnTo);
      const rootHost = tenantUrl.hostname.startsWith('www.')
        ? tenantUrl.hostname.slice(4)
        : tenantUrl.hostname;
      tenantUrl.hostname =
        rootHost === 'localhost' || rootHost === '127.0.0.1'
          ? `${outcome.tenantName}.localhost`
          : `${outcome.tenantName}.${rootHost}`;
      callbackUrl = new URL('/auth/oauth/callback', tenantUrl);
      callbackUrl.searchParams.set('tenantRegistration', '1');
      callbackUrl.searchParams.set('nonce', oauthState.nonce);
    } else {
      callbackUrl.searchParams.set('nonce', oauthState.nonce);
    }

    const code = await this.authService.createSocialLoginTicket(user.id);
    callbackUrl.searchParams.set('code', code);
    return res.redirect(callbackUrl.toString());
  }
}