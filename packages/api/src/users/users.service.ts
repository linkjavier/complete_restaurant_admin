import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, Location } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type UserResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locationId: string | null;
  location: Location | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithPassword = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locationId: string | null;
  location: Location | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<UserResponse[]> {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        locationId: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        locationId: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        location: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      location: user.location,
    };
  }

  // async create(data: {
  //   email: string;
  //   password: string;
  //   firstName: string;
  //   lastName: string;
  //   role?: UserRole;
  //   locationId?: string | null;
  // }): Promise<UserWithPassword> {
  //   const existingUser = await this.findByEmail(data.email);
  //   if (existingUser) {
  //     throw new ConflictException('Email already in use');
  //   }

  //   const hashedPassword = await bcrypt.hash(data.password, 10);

  //   const user = await this.prisma.user.create({
  //     data: {
  //       ...data,
  //       password: hashedPassword,
  //       role: data.role || UserRole.CUSTOMER,
  //     },
  //     include: {
  //       location: true,
  //     },
  //   });

  //   return {
  //     ...user,
  //     location: user.location,
  //   };
  // }


  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    locationId?: string | null;
  }): Promise<UserWithPassword> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }
  
    const hashedPassword = await bcrypt.hash(data.password, 10);
  
    // Si no se proporciona locationId, asignamos null
    const user = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role || UserRole.CUSTOMER,
        locationId: data.locationId || null, // Bypass de locationId
      },
      include: {
        location: true,
      },
    });
  
    return {
      ...user,
      location: user.location,
    };
  }
  


  async update(
    id: string,
    data: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      locationId?: string | null;
    },
  ): Promise<UserResponse> {
    if (data.email) {
      const existingUser = await this.findByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          locationId: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async updateRole(id: string, role: UserRole): Promise<UserResponse> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          locationId: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async assignLocation(userId: string, locationId: string): Promise<UserResponse> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { locationId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          locationId: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }
} 