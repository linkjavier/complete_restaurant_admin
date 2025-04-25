import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async validateUser(email: string, password: string): Promise<LoginUser | null> {
    console.log("Validando")
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await bcrypt.compare(password, user.password))) {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
      };
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
        location: result.location,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    };
  }

  async register(data: RegisterDto): Promise<LoginResponse> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const dbUser = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        locationId: data.locationId,
      },
      include: {
        location: {
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
  }): Promise<LoginResponse> {
    let dbUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      dbUser = await this.prisma.user.create({
        data: {
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
} 