import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Location } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type UserResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar: string | null;
  locationId: string | null;
  location: Location | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithPassword = UserResponse & {
  password: string;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: {
        location: true,
      },
    });
    return users.map(({ password, ...rest }) => rest);
  }

  async findOne(id: string, tenantId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        location: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string, tenantId: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findFirst({
      where: { email, tenantId },
      include: {
        location: true,
      },
    });
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    avatar?: string | null;
    locationId?: string | null;
  }, tenantId: string): Promise<UserWithPassword> {
    const existingUser = await this.findByEmail(data.email, tenantId);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || UserRole.CUSTOMER,
        location: data.locationId ? { connect: { id: data.locationId } } : undefined,
        avatar: data.avatar || null,
        tenant: { connect: { id: tenantId } },
      },
      include: {
        location: true,
      },
    });
    return user;
  }

  async update(
    id: string,
    data: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      avatar?: string | null;
      locationId?: string | null;
    },
    tenantId: string,
  ): Promise<UserResponse> {
    if (data.email) {
      const existingUser = await this.findByEmail(data.email, tenantId);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const user = await this.prisma.user.update({
      where: { id, tenantId },
      data: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        avatar: data.avatar,
        location: data.locationId ? { connect: { id: data.locationId } } : undefined,
      },
      include: {
        location: true,
      },
    });
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id, tenantId } });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async updateRole(id: string, role: UserRole, tenantId: string): Promise<UserResponse> {
    const user = await this.prisma.user.update({
      where: { id, tenantId },
      data: { role },
      include: {
        location: true,
      },
    });
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async assignLocation(userId: string, locationId: string, tenantId: string): Promise<UserResponse> {
    const user = await this.prisma.user.update({
      where: { id: userId, tenantId },
      data: { location: { connect: { id: locationId } } },
      include: {
        location: true,
      },
    });
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}