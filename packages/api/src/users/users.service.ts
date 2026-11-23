import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserAccessRequestStatus, UserRole, Location } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

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

  async findAccessRequests(tenantId: string) {
    return this.prisma.userAccessRequest.findMany({
      where: { tenantId, status: UserAccessRequestStatus.PENDING },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        requestedAt: true,
      },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async approveAccessRequest(
    id: string,
    role: UserRole,
    tenantId: string,
    reviewerId: string,
  ): Promise<UserResponse> {
    if (!Object.values(UserRole).includes(role) || role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Select a valid role other than Super Admin');
    }

    const fallbackPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.userAccessRequest.findFirst({
        where: { id, tenantId, status: UserAccessRequestStatus.PENDING },
      });
      if (!request) {
        throw new NotFoundException('Pending access request not found');
      }

      const existingUser = await transaction.user.findFirst({
        where: {
          tenantId,
          email: { equals: request.email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException('An account with this email already exists');
      }

      const updated = await transaction.userAccessRequest.updateMany({
        where: { id, tenantId, status: UserAccessRequestStatus.PENDING },
        data: {
          status: UserAccessRequestStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          passwordHash: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('This access request has already been reviewed');
      }

      const user = await transaction.user.create({
        data: {
          tenantId,
          email: request.email,
          password: request.passwordHash ?? fallbackPassword,
          firstName: request.firstName,
          lastName: request.lastName,
          role,
          avatar: request.avatar,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
          locationId: true,
          createdAt: true,
          updatedAt: true,
          location: true,
        },
      });
      return user;
    });
  }

  async rejectAccessRequest(id: string, tenantId: string, reviewerId: string) {
    const result = await this.prisma.userAccessRequest.updateMany({
      where: { id, tenantId, status: UserAccessRequestStatus.PENDING },
      data: {
        status: UserAccessRequestStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        passwordHash: null,
      },
    });
    if (result.count !== 1) {
      throw new NotFoundException('Pending access request not found');
    }
    return { status: UserAccessRequestStatus.REJECTED };
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

  async create(
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
      avatar?: string | null;
      locationId?: string | null;
    },
    tenantId: string,
    actorRole: UserRole,
  ): Promise<UserWithPassword> {
    if (data.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can create another Super Admin');
    }
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
    actorRole?: UserRole,
  ): Promise<UserResponse> {
    if (data.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can assign the Super Admin role');
    }
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
      await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findFirst({
          where: { id, tenantId },
          select: { email: true },
        });
        if (!user) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }

        await transaction.user.delete({ where: { id, tenantId } });
        await transaction.userAccessRequest.deleteMany({
          where: {
            tenantId,
            email: { equals: user.email, mode: 'insensitive' },
          },
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
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