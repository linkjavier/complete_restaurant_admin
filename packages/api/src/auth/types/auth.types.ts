import { User } from '@prisma/client';

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locationId: string | null;
  location?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  access_token: string;
  user: UserResponse;
}

export interface LoginUser {
  id: string;
  email: string;
  role: string;
  locationId: string | null;
} 