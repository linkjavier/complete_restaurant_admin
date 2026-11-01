import { BadRequestException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from './production.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  InsufficientStockError,
  StockSyncService,
} from '../inventory/stock-sync.service';

describe('ProductionService', () => {
  let service: ProductionService;

  const mockTx = {
    product: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    productionLog: { create: jest.fn() },
  };
  const mockPrisma = {
    product: { findFirst: jest.fn() },
    productionLog: { findMany: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockTx)),
  };
  const mockStockSync = {
    deductSyncedStock: jest.fn(),
    deductProductStock: jest.fn(),
  };

  const intermediateProduct = {
    id: 'prep-1',
    name: 'Hamburger meat',
    tenantId: 'tenant-1',
    locationId: 'loc-1',
    isActive: true,
    isIntermediate: true,
    ingredients: [
      {
        ingredientId: 'ing-1',
        quantity: 120,
        ingredient: { id: 'ing-1', name: 'Ground beef', unit: 'g' },
      },
    ],
    components: [],
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
    mockTx.product.findFirst.mockResolvedValue(intermediateProduct);
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });
    mockTx.product.findUniqueOrThrow.mockResolvedValue({
      ...intermediateProduct,
      quantity: 2,
    });
    mockTx.productionLog.create.mockResolvedValue({ id: 'log-1' });
  });

  it('deducts the complete batch recipe and records output and waste', async () => {
    const result = await service.produceProduct(
      'prep-1',
      2,
      'tenant-1',
      'loc-1',
      0.5,
      'spill',
    );

    expect(mockStockSync.deductSyncedStock).toHaveBeenCalledWith(mockTx, {
      ingredientId: 'ing-1',
      locationId: 'loc-1',
      amount: 300,
    });
    expect(mockTx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'prep-1',
        tenantId: 'tenant-1',
        locationId: 'loc-1',
        isIntermediate: true,
        isActive: true,
      },
      data: { quantity: { increment: 2 } },
    });
    expect(mockTx.productionLog.create).toHaveBeenCalledWith({
      data: {
        productId: 'prep-1',
        quantity: 2,
        wasteQuantity: 0.5,
        wasteNotes: 'spill',
      },
    });
    expect(result.consumedIngredients).toEqual([
      { id: 'ing-1', name: 'Ground beef', unit: 'g', quantity: 300 },
    ]);
  });

  it('deducts intermediate products required by the recipe', async () => {
    mockTx.product.findFirst.mockResolvedValue({
      ...intermediateProduct,
      ingredients: [],
      components: [
        {
          componentId: 'prep-meat',
          quantity: 2,
          component: { id: 'prep-meat', name: 'Patty', unit: 'unidad' },
        },
      ],
    });

    await service.produceProduct('prep-1', 3, 'tenant-1', 'loc-1');

    expect(mockStockSync.deductProductStock).toHaveBeenCalledWith(mockTx, {
      productId: 'prep-meat',
      locationId: 'loc-1',
      amount: 6,
    });
  });

  it('returns 400 when recipe stock is insufficient', async () => {
    mockStockSync.deductSyncedStock.mockRejectedValue(
      new InsufficientStockError({
        name: 'Ground beef',
        required: 120,
        available: 20,
      }),
    );

    await expect(
      service.produceProduct('prep-1', 1, 'tenant-1', 'loc-1'),
    ).rejects.toMatchObject({
      response: {
        message: 'Insumos insuficientes para registrar la producción',
        missing: [{ name: 'Ground beef', required: 120, available: 20 }],
      },
      status: 400,
    });
    expect(mockTx.product.updateMany).not.toHaveBeenCalled();
    expect(mockTx.productionLog.create).not.toHaveBeenCalled();
  });

  it('does not produce a product outside the authorized location', async () => {
    mockTx.product.findFirst.mockResolvedValue(null);

    await expect(
      service.produceProduct('prep-1', 1, 'tenant-1', 'loc-other'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('requires an intermediate product with a configured recipe', async () => {
    mockTx.product.findFirst.mockResolvedValue({
      ...intermediateProduct,
      ingredients: [],
      components: [],
    });

    await expect(
      service.produceProduct('prep-1', 1, 'tenant-1', 'loc-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
