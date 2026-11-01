import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService recipes', () => {
  let service: ProductsService;

  const mockTx = {
    ingredient: { findMany: jest.fn() },
    product: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productComponent: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productIngredient: { create: jest.fn(), deleteMany: jest.fn() },
    productVariantGroup: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    productVariant: { create: jest.fn(), updateMany: jest.fn() },
  };
  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx.ingredient.findMany.mockResolvedValue([]);
    mockTx.product.findMany.mockResolvedValue([{ id: 'patty' }]);
    mockTx.product.create.mockResolvedValue({ id: 'burger', locationId: 'loc-1' });
    mockTx.productComponent.create.mockResolvedValue({});
    mockTx.product.findUnique.mockResolvedValue({ id: 'burger' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('creates a recipe that consumes an intermediate product', async () => {
    await service.create(
      {
        name: 'Hamburguesa doble',
        locationId: 'loc-1',
        ingredients: [],
        components: [{ componentId: 'patty', quantity: 2 }],
      },
      'tenant-1',
    );

    expect(mockTx.product.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['patty'] },
        tenantId: 'tenant-1',
        locationId: 'loc-1',
        isIntermediate: true,
      },
      select: { id: true },
    });
    expect(mockTx.productComponent.create).toHaveBeenCalledWith({
      data: {
        productId: 'burger',
        componentId: 'patty',
        quantity: 2,
      },
    });
  });

  it('rejects intermediate products from a different location', async () => {
    mockTx.product.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        {
          name: 'Hamburguesa',
          locationId: 'loc-1',
          components: [{ componentId: 'patty', quantity: 1 }],
        },
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTx.product.create).not.toHaveBeenCalled();
  });

  it('rejects cyclic recipes', async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: 'burger',
      locationId: 'loc-1',
      ingredients: [],
      components: [],
    });
    mockTx.productComponent.findMany.mockResolvedValue([
      { componentId: 'burger' },
    ]);

    await expect(
      service.update(
        'burger',
        { components: [{ componentId: 'patty', quantity: 1 }] },
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTx.product.update).not.toHaveBeenCalled();
  });
});
