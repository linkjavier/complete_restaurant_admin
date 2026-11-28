import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export async function resolveLocationScope(
  prisma: PrismaService,
  tenantId: string,
  user: User,
  requestedLocationId?: string,
): Promise<string | undefined> {
  if (user.tenantId !== tenantId) {
    throw new ForbiddenException('User does not belong to this tenant.');
  }

  const requested = requestedLocationId?.trim();
  if (user.role === UserRole.SUPER_ADMIN) {
    if (!requested) return undefined;
    const location = await prisma.location.findFirst({
      where: { id: requested, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found for this tenant.');
    }
    return location.id;
  }

  if (!user.locationId || (requested && requested !== user.locationId)) {
    throw new ForbiddenException("The requested data is outside the user's assigned location.");
  }
  return user.locationId;
}
