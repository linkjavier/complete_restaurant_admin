import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private whatsappService: WhatsappService,
  ) {}

  async create(data: CreateCustomerDto, tenantId: string) {
    try {
      return await this.prisma.customer.create({
        data: {
          ...data,
          tenantId,
        },
      });
    } catch (error) {
      if (error.message.includes('Unique constraint failed')) {
        const existingCustomer = await this.findByPhone(data.phone, data.locationId, tenantId);
        if (existingCustomer) {
          return existingCustomer;
        }
      }
      throw error;
    }
  }

  async findAll(locationId: string, tenantId: string) {
    return this.prisma.customer.findMany({ where: { locationId, tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.customer.findFirst({ where: { id, tenantId } });
  }

  async findByPhone(phone: string, locationId: string, tenantId: string) {
    // Normalizar el número a solo dígitos
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    console.log(`[CUSTOMERSERVICE] Buscando cliente por teléfono: ${normalizedPhone}, locationId: ${locationId}`);
    const customer = await this.prisma.customer.findFirst({ 
      where: { 
        phone: normalizedPhone,
        locationId,
        tenantId
      } 
    });
    if (customer) {
      console.log(`[CUSTOMERSERVICE] Cliente encontrado: ${customer.name} (${customer.phone})`);
    } else {
      console.log(`[CUSTOMERSERVICE] Cliente NO encontrado para: ${normalizedPhone} en locationId: ${locationId}`);
    }
    return customer;
  }

  async update(id: string, data: UpdateCustomerDto, tenantId: string) {
    return this.prisma.customer.update({ where: { id, tenantId }, data });
  }

  async remove(id: string, tenantId: string) {
    return this.prisma.customer.delete({ where: { id, tenantId } });
  }

  async syncFromWhatsApp(locationId: string, tenantId: string) {
    try {
      // Llama a WhatsappService.getChats para forzar la captura de clientes
      const chats = await this.whatsappService.getChats(tenantId, locationId);
      // Devuelve un resumen
      const total = await this.prisma.customer.count({ where: { locationId, tenantId } });
      return {
        success: true,
        message: `Sincronización completada. Total de clientes: ${total}`,
        total
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error durante la sincronización: ' + error.message
      };
    }
  }

  private extractCustomerInfo(messages: any[], chatId: string) {
    // Extraer número de teléfono del chatId
    const phone = chatId.replace('@c.us', '');
    
    // Buscar información del cliente en los mensajes
    let name = '';
    let address = '';
    let neighborhood = '';

    for (const message of messages) {
      const text = message.body.toLowerCase();
      
      // Buscar patrones de nombre
      if (!name && (text.includes('me llamo') || text.includes('soy') || text.includes('mi nombre'))) {
        const nameMatch = message.body.match(/(?:me llamo|soy|mi nombre es?)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);
        if (nameMatch) {
          name = nameMatch[1].trim();
        }
      }

      // Buscar patrones de dirección
      if (!address && (text.includes('dirección') || text.includes('direccion') || text.includes('vivo en'))) {
        const addressMatch = message.body.match(/(?:dirección|direccion|vivo en|mi dirección es?)\s*:?\s*([^,.\n]+)/i);
        if (addressMatch) {
          address = addressMatch[1].trim();
        }
      }

      // Buscar patrones de barrio
      if (!neighborhood && (text.includes('barrio') || text.includes('sector') || text.includes('zona'))) {
        const neighborhoodMatch = message.body.match(/(?:barrio|sector|zona)\s*:?\s*([^,.\n]+)/i);
        if (neighborhoodMatch) {
          neighborhood = neighborhoodMatch[1].trim();
        }
      }
    }

    // Si no encontramos nombre, usar un nombre genérico
    if (!name) {
      name = `Cliente ${phone.slice(-4)}`;
    }

    return {
      name,
      phone,
      address: address || null,
      neighborhood: neighborhood || null
    };
  }

  async seedCustomers(locationId: string, tenantId: string) {
    const sampleCustomers = [
      {
        name: 'María González',
        phone: '3001234567',
        email: 'maria@example.com',
        locationId,
        tenantId,
      },
      {
        name: 'Carlos Rodríguez',
        phone: '3109876543',
        email: 'carlos@example.com',
        locationId,
        tenantId,
      },
      {
        name: 'Ana Martínez',
        phone: '3155551234',
        email: 'ana@example.com',
        locationId,
        tenantId,
      },
      {
        name: 'Luis Pérez',
        phone: '3207778888',
        email: 'luis@example.com',
        locationId,
        tenantId,
      },
      {
        name: 'Sofia Herrera',
        phone: '3009990000',
        email: 'sofia@example.com',
        locationId,
        tenantId,
      },
    ];
    const createdCustomers = [];
    for (const customerData of sampleCustomers) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: { phone: customerData.phone, locationId, tenantId }
      });
      if (!existingCustomer) {
        const customer = await this.prisma.customer.create({ data: customerData });
        createdCustomers.push(customer);
      }
    }
    return createdCustomers;
  }

  async upsert(data: CreateCustomerDto, tenantId: string) {
    const normalizedPhone = data.phone.replace(/[^0-9]/g, '');
    return this.prisma.customer.upsert({
      where: {
        id: (await this.findByPhone(normalizedPhone, data.locationId, tenantId))?.id || 'temp-id',
      },
      update: data,
      create: { ...data, phone: normalizedPhone, tenantId },
    });
  }
} 