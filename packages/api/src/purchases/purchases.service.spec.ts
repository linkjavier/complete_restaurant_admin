import { BadRequestException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockSyncService } from '../inventory/stock-sync.service';

describe('PurchasesService supplier integration', () => {
  const tx = {
    location: { findFirst: jest.fn() },
    supplier: { findFirst: jest.fn() },
    purchase: { create: jest.fn(), findUnique: jest.fn() },
    ingredient: { findUnique: jest.fn(), update: jest.fn() },
    inventoryItem: { upsert: jest.fn() },
    purchaseItem: { create: jest.fn() },
    supplierIngredient: { upsert: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
  const dto = {
    supplierId: 'supplier-1',
    locationId: 'location-1',
    purchaseDate: '2026-01-01',
    items: [{ ingredientId: 'ingredient-1', quantity: 3, unitCost: 2 }],
  };
  let service: PurchasesService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.location.findFirst.mockResolvedValue({ id: 'location-1' });
    tx.supplier.findFirst.mockResolvedValue({ id: 'supplier-1', name: 'Proveedor' });
    tx.purchase.create.mockResolvedValue({ id: 'purchase-1' });
    tx.purchase.findUnique.mockResolvedValue({ id: 'purchase-1' });
    tx.ingredient.findUnique.mockResolvedValue({
      id: 'ingredient-1',
      tenantId: 'tenant-1',
      locationId: 'location-1',
      minQuantity: 0,
    });
    tx.ingredient.update.mockResolvedValue({ quantity: 3 });
    service = new PurchasesService(prisma as unknown as PrismaService, {} as StockSyncService);
  });

  it('records the supplier snapshot, increments inventory once, and links its catalog', async () => {
    await service.create(dto, 'tenant-1', 'user-1');

    expect(tx.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: 'supplier-1', tenantId: 'tenant-1', isActive: true },
    });
    expect(tx.purchase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        supplier: { connect: { id: 'supplier-1' } },
        supplierName: 'Proveedor',
      }),
    }));
    expect(tx.ingredient.update).toHaveBeenCalledTimes(1);
    expect(tx.ingredient.update).toHaveBeenCalledWith({
      where: { id: 'ingredient-1' },
      data: { quantity: { increment: 3 } },
    });
    expect(tx.inventoryItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.supplierIngredient.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { supplierId_ingredientId: { supplierId: 'supplier-1', ingredientId: 'ingredient-1' } },
      create: expect.objectContaining({ unitCost: 2 }),
    }));
  });

  it('rejects a supplier outside the tenant or inactive before changing stock', async () => {
    tx.supplier.findFirst.mockResolvedValue(null);
    await expect(service.create(dto, 'tenant-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.purchase.create).not.toHaveBeenCalled();
    expect(tx.ingredient.update).not.toHaveBeenCalled();
  });

  it('rejects an ingredient from another location', async () => {
    tx.ingredient.findUnique.mockResolvedValue({
      id: 'ingredient-1', tenantId: 'tenant-1', locationId: 'location-2',
    });
    await expect(service.create(dto, 'tenant-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.ingredient.update).not.toHaveBeenCalled();
    expect(tx.supplierIngredient.upsert).not.toHaveBeenCalled();
  });
});
