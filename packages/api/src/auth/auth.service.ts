import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserResponse, LoginResponse, LoginUser } from './types/auth.types';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string, tenantId: string): Promise<LoginUser | null> {
    console.log("[validateUser] tenantId:", tenantId, "email:", email);
    const user = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    console.log("[validateUser] user found:", !!user, user ? user.email : null);
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
      }
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
    tenantId: string;
  }): Promise<LoginResponse> {
    let dbUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: user.tenantId, email: user.email } },
    });

    if (!dbUser) {
      dbUser = await this.prisma.user.create({
        data: {
          tenantId: user.tenantId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10),
          role: UserRole.CUSTOMER,
          locationId: null,
        },
      });
    }

    return this.login({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      locationId: dbUser.locationId,
    });
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