import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService tenant scope', () => {
  const prisma = {
    supplier: { findFirst: jest.fn() },
    ingredient: { findFirst: jest.fn() },
    supplierIngredient: { upsert: jest.fn() },
  };
  const service = new SuppliersService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('does not associate an ingredient from another tenant', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'supplier-1' });
    prisma.ingredient.findFirst.mockResolvedValue(null);
    await expect(service.saveIngredient('tenant-1', 'supplier-1', {
      ingredientId: 'other-ingredient',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ingredient.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-ingredient', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(prisma.supplierIngredient.upsert).not.toHaveBeenCalled();
  });

  it('rejects another tenant’s supplier', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.ingredient.findFirst.mockResolvedValue({ id: 'ingredient-1' });
    await expect(service.saveIngredient('tenant-1', 'other-supplier', {
      ingredientId: 'ingredient-1',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supplierIngredient.upsert).not.toHaveBeenCalled();
  });
});
