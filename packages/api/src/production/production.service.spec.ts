import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ProductionService } from './production.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  InsufficientStockError,
  StockSyncService,
} from '../inventory/stock-sync.service';

describe('ProductionService', () => {
  let service: ProductionService;

  const mockTx = {
    product: { update: jest.fn() },
    productionLog: { create: jest.fn() },
  };

  const mockPrisma = {
    product: { findFirst: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  const mockStockSync = {
    deductSyncedStock: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StockSyncService, useValue: mockStockSync },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  it('deducts synced stock and creates production log', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      isActive: true,
      locationId: 'loc-1',
      ingredients: [
        {
          quantity: 2,
          ingredient: { id: 'ing-1', name: 'Flour' },
        },
      ],
    });
    mockStockSync.deductSyncedStock.mockResolvedValue({
      previousQuantity: 10,
      newQuantity: 6,
    });
    mockTx.product.update.mockResolvedValue({ id: 'prod-1', quantity: 5 });
    mockTx.productionLog.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.produceProduct('prod-1', 2, 'tenant-1', 0.5, 'spill');

    expect(mockStockSync.deductSyncedStock).toHaveBeenCalledWith(mockTx, {
      ingredientId: 'ing-1',
      locationId: 'loc-1',
      amount: 4,
    });
    expect(mockTx.productionLog.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-1',
        quantity: 2,
        wasteQuantity: 0.5,
        wasteNotes: 'spill',
      },
    });
    expect(result.success).toBe(true);
  });

  it('returns 400 when synced stock is insufficient', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      isActive: true,
      locationId: 'loc-1',
      ingredients: [
        {
          quantity: 1,
          ingredient: { id: 'ing-1', name: 'Flour' },
        },
      ],
    });
    mockStockSync.deductSyncedStock.mockRejectedValue(
      new InsufficientStockError({
        name: 'Flour',
        required: 5,
        available: 1,
      }),
    );

    await expect(service.produceProduct('prod-1', 5, 'tenant-1')).rejects.toMatchObject({
      response: {
        message: 'Insufficient ingredients',
        missing: [{ name: 'Flour', required: 5, available: 1 }],
      },
      status: 400,
    });
  });

  it('returns 404 when product is not in tenant', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.produceProduct('prod-1', 1, 'tenant-1'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
