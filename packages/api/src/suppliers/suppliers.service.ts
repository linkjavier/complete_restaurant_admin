import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SupplierIngredientDto } from './dto/supplier-ingredient.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const optionalText = (value?: string) => value?.trim() || null;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, search?: string, includeInactive = false) {
    return this.prisma.supplier.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search?.trim() && {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { taxId: { contains: search.trim(), mode: 'insensitive' } },
            { contactName: { contains: search.trim(), mode: 'insensitive' } },
            { email: { contains: search.trim(), mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { purchases: true, ingredients: true } } },
    });
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { tenantId, id },
      include: {
        ingredients: {
          orderBy: { ingredient: { name: 'asc' } },
          include: { ingredient: { include: { category: true, location: true } } },
        },
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          take: 50,
          include: {
            location: true,
            items: { include: { ingredient: true } },
          },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');
    return supplier;
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    const name = dto.name.trim();
    const duplicate = await this.prisma.supplier.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ya existe un proveedor con ese nombre.');

    try {
      return await this.prisma.supplier.create({
        data: {
          tenantId,
          name,
          taxId: optionalText(dto.taxId),
          contactName: optionalText(dto.contactName),
          email: optionalText(dto.email),
          phone: optionalText(dto.phone),
          address: optionalText(dto.address),
          notes: optionalText(dto.notes),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un proveedor con esos datos de identificación.');
      }
      throw error;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Proveedor no encontrado.');

    if (dto.name?.trim()) {
      const duplicate = await this.prisma.supplier.findFirst({
        where: {
          tenantId,
          id: { not: id },
          name: { equals: dto.name.trim(), mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Ya existe un proveedor con ese nombre.');
    }

    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.taxId !== undefined && { taxId: optionalText(dto.taxId) }),
          ...(dto.contactName !== undefined && { contactName: optionalText(dto.contactName) }),
          ...(dto.email !== undefined && { email: optionalText(dto.email) }),
          ...(dto.phone !== undefined && { phone: optionalText(dto.phone) }),
          ...(dto.address !== undefined && { address: optionalText(dto.address) }),
          ...(dto.notes !== undefined && { notes: optionalText(dto.notes) }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un proveedor con esos datos de identificación.');
      }
      throw error;
    }
  }

  async archive(tenantId: string, id: string) {
    const result = await this.prisma.supplier.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    if (result.count === 0) throw new NotFoundException('Proveedor no encontrado.');
    return { success: true };
  }

  async saveIngredient(tenantId: string, supplierId: string, dto: SupplierIngredientDto) {
    const [supplier, ingredient] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } }),
      this.prisma.ingredient.findFirst({
        where: { id: dto.ingredientId, tenantId },
        select: { id: true },
      }),
    ]);
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');
    if (!ingredient) throw new BadRequestException('El ingrediente no pertenece a este negocio.');

    const values = {
      supplierSku: optionalText(dto.supplierSku),
      unitCost: dto.unitCost ?? null,
      packaging: optionalText(dto.packaging),
      minimumOrderQuantity: dto.minimumOrderQuantity ?? null,
      leadTimeDays: dto.leadTimeDays ?? null,
      notes: optionalText(dto.notes),
      isActive: true,
    };

    return this.prisma.supplierIngredient.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId,
          ingredientId: dto.ingredientId,
        },
      },
      create: { supplierId, ingredientId: dto.ingredientId, ...values },
      update: {
        ...values,
        ...(dto.notes === undefined && { notes: undefined }),
      },
      include: { ingredient: { include: { category: true, location: true } } },
    });
  }

  async removeIngredient(tenantId: string, supplierId: string, ingredientId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');

    const result = await this.prisma.supplierIngredient.deleteMany({
      where: { supplierId, ingredientId },
    });
    if (result.count === 0) throw new NotFoundException('Ingrediente no encontrado en el catálogo.');
    return { success: true };
  }
}
