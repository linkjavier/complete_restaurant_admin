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

  async create(data: CreateCustomerDto) {
    return this.prisma.customer.create({ data });
  }

  async findAll(locationId: string) {
    return this.prisma.customer.findMany({ where: { locationId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  async findByPhone(phone: string, locationId: string) {
    return this.prisma.customer.findFirst({ 
      where: { 
        phone,
        locationId 
      } 
    });
  }

  async update(id: string, data: UpdateCustomerDto) {
    return this.prisma.customer.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  async syncFromWhatsApp(locationId: string) {
    try {
      // Llama a WhatsappService.getChats para forzar la captura de clientes
      const chats = await this.whatsappService.getChats(locationId);
      // Devuelve un resumen
      const total = await this.prisma.customer.count({ where: { locationId } });
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

  async seedCustomers(locationId: string) {
    const sampleCustomers = [
      {
        name: 'María González',
        phone: '3001234567',
        address: 'Calle 123 #45-67',
        neighborhood: 'Centro',
        locationId,
      },
      {
        name: 'Carlos Rodríguez',
        phone: '3109876543',
        address: 'Carrera 78 #12-34',
        neighborhood: 'La Soledad',
        locationId,
      },
      {
        name: 'Ana Martínez',
        phone: '3155551234',
        address: 'Avenida 5 #23-45',
        neighborhood: 'San Fernando',
        locationId,
      },
      {
        name: 'Luis Pérez',
        phone: '3207778888',
        address: 'Calle 90 #67-89',
        neighborhood: 'El Prado',
        locationId,
      },
      {
        name: 'Sofia Herrera',
        phone: '3009990000',
        address: 'Carrera 45 #12-78',
        neighborhood: 'Buenos Aires',
        locationId,
      },
    ];

    const createdCustomers = [];
    for (const customerData of sampleCustomers) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: { phone: customerData.phone, locationId }
      });
      
      if (!existingCustomer) {
        const customer = await this.prisma.customer.create({ data: customerData });
        createdCustomers.push(customer);
      }
    }

    return createdCustomers;
  }
} 