import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StockSyncService } from '../inventory/stock-sync.service';
import { IngredientsService } from './ingredients.service';

describe('IngredientsService', () => {
  let service: IngredientsService;

  const transaction = {
    location: { findFirst: jest.fn() },
    ingredient: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
  };
  const stockSync = { syncFromIngredient: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    transaction.location.findFirst.mockResolvedValue({ id: 'location-1' });
    transaction.ingredient.create.mockResolvedValue({ id: 'ingredient-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StockSyncService, useValue: stockSync },
      ],
    }).compile();

    service = module.get<IngredientsService>(IngredientsService);
  });

  it('creates an ingredient scoped to the authenticated tenant and syncs its stock', async () => {
    const ingredient = {
      name: 'Carne molida',
      quantity: 0,
      unit: 'g',
      minQuantity: 0,
      locationId: 'location-1',
      tenantId: 'tenant-1',
    };

    await service.create(ingredient);

    expect(transaction.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(transaction.ingredient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Carne molida',
          tenant: { connect: { id: 'tenant-1' } },
        }),
      }),
    );
    expect(stockSync.syncFromIngredient).toHaveBeenCalledWith(transaction, {
      id: 'ingredient-1',
    });
  });

  it('rejects a location outside the authenticated tenant', async () => {
    transaction.location.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Carne molida',
        quantity: 0,
        unit: 'g',
        minQuantity: 0,
        locationId: 'other-tenant-location',
        tenantId: 'tenant-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.ingredient.create).not.toHaveBeenCalled();
  });
});
