import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserAccessRequestStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { LoginResponse, LoginUser } from './types/auth.types';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

export type SocialProvider = 'google' | 'facebook';

interface SocialOAuthState {
  purpose: 'social-login';
  provider: SocialProvider;
  tenantId: string;
  returnTo: string;
  nonce: string;
  mode: 'login' | 'business-registration';
  tenantName?: string;
}

export type SocialLoginOutcome =
  | { status: 'authenticated'; user: LoginUser }
  | { status: 'pending' }
  | { status: 'business-created'; tenantName: string; user: LoginUser };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string, tenantId: string): Promise<LoginUser | null> {
    console.log("[validateUser] tenantId:", tenantId, "email:", email);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: email.trim(), mode: 'insensitive' },
      },
    });
    console.log("[validateUser] user found:", !!user, user ? user.email : null, user ? user.tenantId : null);
    if (user) {
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log("[validateUser] password match:", passwordMatch);
      if (passwordMatch) {
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          locationId: user.locationId,
        };
      } else {
        console.log("[validateUser] Password does not match for user:", email);
      }
    } else {
      console.log("[validateUser] No user found for email and tenantId:", email, tenantId);
    }
    return null;
  }

  async login(user: LoginUser): Promise<LoginResponse> {
    console.log("login service")
    const result = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!result) {
      throw new UnauthorizedException();
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
      tenantId: result.tenantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        locationId: result.locationId,
        avatar: result.avatar,
        location: result.location,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    };
  }

  async register(
    data: RegisterDto,
    tenantId?: string,
  ): Promise<LoginResponse | { status: 'pending' }> {
    const email = data.email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(data.password, 10);

    if (tenantId && tenantId !== 'default-tenant') {
      await this.createOrRefreshAccessRequest({
        tenantId,
        email,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        avatar: data.avatar,
        passwordHash: hashedPassword,
      });
      return { status: 'pending' };
    }

    const tenantName = this.normalizeTenantName(data.tenantName);
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: { equals: tenantName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingTenant) {
      throw new ConflictException('A business with this name already exists');
    }

    const userId = await this.prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({
        data: { name: tenantName },
      });
      const user = await transaction.user.create({
        data: {
          tenantId: tenant.id,
          email,
          password: hashedPassword,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          role: UserRole.SUPER_ADMIN,
          avatar: data.avatar,
        },
      });
      return user.id;
    });

    return this.login({
      id: userId,
      email,
      role: UserRole.SUPER_ADMIN,
      locationId: null,
    });
  }

  async socialLogin(user: {
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    tenantId: string;
  }): Promise<SocialLoginOutcome> {
    const email = user.email.trim().toLowerCase();
    const matchingUsers = await this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        email: { equals: email, mode: 'insensitive' },
      },
      take: 2,
    });
    if (matchingUsers.length > 1) {
      throw new ConflictException('Multiple accounts use this email in the selected tenant');
    }

    const dbUser = matchingUsers[0];
    if (dbUser) {
      return {
        status: 'authenticated',
        user: {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          locationId: dbUser.locationId,
        },
      };
    }

    await this.createOrRefreshAccessRequest({
      tenantId: user.tenantId,
      email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
    });
    return { status: 'pending' };
  }

  async finishSocialLogin(
    profile: { email: string; firstName: string; lastName: string; avatar?: string },
    state: SocialOAuthState,
  ): Promise<SocialLoginOutcome> {
    if (state.mode === 'business-registration') {
      return this.registerSocialBusiness(profile, state.tenantName);
    }
    return this.socialLogin({ ...profile, tenantId: state.tenantId });
  }

  async createSocialAuthorizationUrl(
    provider: SocialProvider,
    tenantId: string,
    returnTo: string,
    nonce: string,
    registeringBusiness = false,
    requestedTenantName?: string,
  ): Promise<string> {
    if (!tenantId) {
      throw new UnauthorizedException('A tenant is required for social login');
    }
    if (!/^[\da-f-]{36}$/i.test(nonce)) {
      throw new BadRequestException('Invalid social login nonce');
    }

    const safeReturnTo = await this.validateSocialReturnTo(returnTo, tenantId);
    const mode = registeringBusiness && tenantId === 'default-tenant'
      ? 'business-registration'
      : 'login';
    if (tenantId === 'default-tenant' && mode !== 'business-registration') {
      throw new BadRequestException('Select a business before signing in');
    }
    const tenantName = mode === 'business-registration'
      ? this.normalizeTenantName(requestedTenantName)
      : undefined;
    const clientId =
      provider === 'google'
        ? this.configService.get<string>('GOOGLE_CLIENT_ID')
        : this.configService.get<string>('FACEBOOK_CLIENT_ID') ||
          this.configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret =
      provider === 'google'
        ? this.configService.get<string>('GOOGLE_CLIENT_SECRET')
        : this.configService.get<string>('FACEBOOK_CLIENT_SECRET') ||
          this.configService.get<string>('FACEBOOK_APP_SECRET');
    const callbackUrl = this.configService.get<string>(
      provider === 'google' ? 'GOOGLE_CALLBACK_URL' : 'FACEBOOK_CALLBACK_URL',
    );

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new ServiceUnavailableException(`${provider} login is not configured on the server`);
    }

    const state = await this.jwtService.signAsync(
      {
        purpose: 'social-login',
        provider,
        tenantId,
        returnTo: safeReturnTo,
        nonce,
        mode,
        tenantName,
      },
      { expiresIn: '10m' },
    );
    const authorizationUrl = new URL(
      provider === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://www.facebook.com/dialog/oauth',
    );
    authorizationUrl.searchParams.set('client_id', clientId);
    authorizationUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set(
      'scope',
      provider === 'google' ? 'openid email profile' : 'email,public_profile',
    );
    if (provider === 'google') {
      authorizationUrl.searchParams.set('prompt', 'select_account');
    }

    return authorizationUrl.toString();
  }

  async verifySocialOAuthState(state: string, provider: SocialProvider): Promise<SocialOAuthState> {
    let payload: SocialOAuthState;
    try {
      payload = await this.jwtService.verifyAsync<SocialOAuthState>(state);
    } catch {
      throw new UnauthorizedException('Invalid or expired social login state');
    }

    if (
      payload.purpose !== 'social-login' ||
      payload.provider !== provider ||
      !payload.tenantId ||
      !payload.returnTo ||
      !['login', 'business-registration'].includes(payload.mode) ||
      (payload.mode === 'business-registration' && !payload.tenantName) ||
      !/^[\da-f-]{36}$/i.test(payload.nonce)
    ) {
      throw new UnauthorizedException('Invalid social login state');
    }
    return payload;
  }

  private normalizeTenantName(value?: string): string {
    if (!value?.trim()) {
      throw new BadRequestException('Business name is required');
    }
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63)
      .replace(/-$/g, '');
    if (!normalized || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      throw new BadRequestException('Business name must contain letters or numbers');
    }
    return normalized;
  }

  private async createOrRefreshAccessRequest(data: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    passwordHash?: string;
  }) {
    const email = data.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId: data.tenantId,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists in this business');
    }

    const existing = await this.prisma.userAccessRequest.findUnique({
      where: { tenantId_email: { tenantId: data.tenantId, email } },
    });
    if (existing) {
      const shouldRefreshRequestDate =
        existing.status === UserAccessRequestStatus.REJECTED ||
        existing.status === UserAccessRequestStatus.APPROVED;
      const request = await this.prisma.userAccessRequest.update({
        where: { id: existing.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          avatar: data.avatar,
          passwordHash: data.passwordHash ?? existing.passwordHash,
          status: UserAccessRequestStatus.PENDING,
          requestedAt: shouldRefreshRequestDate ? new Date() : existing.requestedAt,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      return request;
    }

    return this.prisma.userAccessRequest.create({
      data: {
        tenantId: data.tenantId,
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar,
        passwordHash: data.passwordHash,
      },
    });
  }

  private async registerSocialBusiness(
    profile: { email: string; firstName: string; lastName: string; avatar?: string },
    requestedTenantName?: string,
  ): Promise<SocialLoginOutcome> {
    const tenantName = this.normalizeTenantName(requestedTenantName);
    const email = profile.email.trim().toLowerCase();
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: { equals: tenantName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingTenant) {
      throw new ConflictException('A business with this name already exists');
    }
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    const user = await this.prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({ data: { name: tenantName } });
      const createdUser = await transaction.user.create({
        data: {
          tenantId: tenant.id,
          email,
          password,
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: UserRole.SUPER_ADMIN,
          locationId: null,
          avatar: profile.avatar,
        },
      });
      return createdUser;
    });
    return {
      status: 'business-created',
      tenantName,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
      },
    };
  }

  async createSocialLoginTicket(userId: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 60_000);

    await this.prisma.oAuthLoginTicket.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.prisma.oAuthLoginTicket.create({
      data: { codeHash, userId, expiresAt },
    });

    return code;
  }

  async exchangeSocialLoginTicket(code: string): Promise<LoginResponse> {
    if (!code || code.length > 128) {
      throw new BadRequestException('A valid social login code is required');
    }

    const codeHash = createHash('sha256').update(code).digest('hex');
    const userId = await this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.oAuthLoginTicket.findUnique({
        where: { codeHash },
      });
      const now = new Date();
      if (!ticket || ticket.expiresAt <= now) {
        throw new UnauthorizedException('Social login code is invalid or expired');
      }

      const consumed = await transaction.oAuthLoginTicket.deleteMany({
        where: { id: ticket.id, expiresAt: { gt: now } },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Social login code has already been used');
      }
      return ticket.userId;
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User for social login code was not found');
    }
    return this.login({
      id: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
    });
  }

  private async validateSocialReturnTo(returnTo: string, tenantId: string): Promise<string> {
    let candidate: URL;
    let configuredFrontend: URL;
    try {
      candidate = new URL(returnTo);
      configuredFrontend = new URL(
        this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001'),
      );
    } catch {
      throw new BadRequestException('Invalid social login return URL');
    }

    const domainParts = configuredFrontend.hostname.split('.');
    const allowedBaseDomain =
      domainParts.length > 2 ? domainParts.slice(1).join('.') : configuredFrontend.hostname;
    const hostIsAllowed =
      candidate.hostname === configuredFrontend.hostname ||
      candidate.hostname.endsWith(`.${allowedBaseDomain}`);

    if (
      candidate.protocol !== configuredFrontend.protocol ||
      candidate.port !== configuredFrontend.port ||
      !hostIsAllowed ||
      candidate.username ||
      candidate.password ||
      candidate.pathname !== '/' ||
      candidate.search ||
      candidate.hash
    ) {
      throw new BadRequestException('Social login return URL is not allowed');
    }

    if (tenantId === 'default-tenant') {
      if (candidate.hostname !== configuredFrontend.hostname) {
        throw new BadRequestException('Social login return URL does not match the tenant');
      }
    } else {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      const returnSubdomainLabels = candidate.hostname.endsWith(`.${allowedBaseDomain}`)
        ? candidate.hostname.slice(0, -(allowedBaseDomain.length + 1)).split('.')
        : [];
      const returnSubdomain =
        returnSubdomainLabels.length === 1 ? returnSubdomainLabels[0] : null;
      if (!tenant || returnSubdomain?.toLowerCase() !== tenant.name.toLowerCase()) {
        throw new BadRequestException('Social login return URL does not match the tenant');
      }
    }

    return candidate.origin;
  }

  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException();
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        locationId: user.locationId,
        avatar: user.avatar,
        location: user.location,
      };
    } catch (error) {
      throw new UnauthorizedException();
    }
  }
}