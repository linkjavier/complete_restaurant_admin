import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
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
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string, tenantId: string): Promise<LoginUser | null> {
    console.log("[validateUser] tenantId:", tenantId, "email:", email);
    const user = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
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

  async register(data: RegisterDto, tenantId: string): Promise<LoginResponse> {
    // Si no hay tenantId pero sí tenantName, crear el tenant
    let finalTenantId = tenantId;
    if (!finalTenantId && data.tenantName) {
      // Verificar si ya existe un tenant con ese nombre
      const existingTenant = await this.prisma.tenant.findFirst({ where: { name: data.tenantName } });
      if (existingTenant) {
        finalTenantId = existingTenant.id;
      } else {
        const newTenant = await this.prisma.tenant.create({ data: { name: data.tenantName } });
        finalTenantId = newTenant.id;
      }
    }
    if (!finalTenantId) {
      throw new UnauthorizedException('tenantId or tenantName is required');
    }
    // Verificar si el email ya existe para ese tenant
    const existingUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: finalTenantId, email: data.email } },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const dbUser = await this.prisma.user.create({
      data: {
        tenantId: finalTenantId,
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'SUPER_ADMIN',
        locationId: data.locationId,
        avatar: data.avatar,
      },
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
    return this.login({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      locationId: dbUser.locationId,
    });
  }

  async socialLogin(user: {
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    tenantId: string;
  }): Promise<LoginUser> {
    const email = user.email.trim().toLowerCase();
    const matchingUsers = await this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        email: { equals: email, mode: 'insensitive' },
      },
      take: 2,
    });
    if (matchingUsers.length > 1) {
      throw new ConflictException(
        'Multiple accounts use this email in the selected tenant',
      );
    }

    let dbUser = matchingUsers[0];
    if (!dbUser) {
      dbUser = await this.prisma.user.create({
        data: {
          tenantId: user.tenantId,
          email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          role: UserRole.CUSTOMER,
          locationId: null,
          avatar: user.avatar,
        },
      });
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      locationId: dbUser.locationId,
    };
  }

  async createSocialAuthorizationUrl(
    provider: SocialProvider,
    tenantId: string,
    returnTo: string,
    nonce: string,
  ): Promise<string> {
    if (!tenantId) {
      throw new UnauthorizedException('A tenant is required for social login');
    }
    if (!/^[\da-f-]{36}$/i.test(nonce)) {
      throw new BadRequestException('Invalid social login nonce');
    }

    const safeReturnTo = await this.validateSocialReturnTo(returnTo, tenantId);
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
      throw new ServiceUnavailableException(
        `${provider} login is not configured on the server`,
      );
    }

    const state = await this.jwtService.signAsync(
      {
        purpose: 'social-login',
        provider,
        tenantId,
        returnTo: safeReturnTo,
        nonce,
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

  async verifySocialOAuthState(
    state: string,
    provider: SocialProvider,
  ): Promise<SocialOAuthState> {
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
      !/^[\da-f-]{36}$/i.test(payload.nonce)
    ) {
      throw new UnauthorizedException('Invalid social login state');
    }
    return payload;
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

  private async validateSocialReturnTo(
    returnTo: string,
    tenantId: string,
  ): Promise<string> {
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