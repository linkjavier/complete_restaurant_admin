import { Injectable } from '@nestjs/common';
import { CustomersService } from '../../customers/customers.service';

export interface CustomerContext {
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
  greeting: string;
}

@Injectable()
export class CustomerContextService {
  constructor(private customersService: CustomersService) {}

  async getCustomerContext(chatId: string, locationId: string, tenantId: string): Promise<CustomerContext> {
    const phone = this.normalizePhone(chatId);
    const customer = await this.customersService.findByPhone(phone, locationId, tenantId);
    
    // DEBUG: Verifica si el customer tiene el nombre y datos correctos
    console.log('[DEBUG][getCustomerContext] phone:', phone, 'customer:', customer);

    if (customer && customer.name) {
      return {
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
        neighborhood: customer.neighborhood || '',
        greeting: `¡Hola, ${customer.name}! \n`
      };
    }

    return {
      name: '',
      phone: '',
      address: '',
      neighborhood: '',
      greeting: ''
    };
  }

  private normalizePhone(chatId: string): string {
    return chatId.replace(/@c\.us$/, '').replace(/[^0-9]/g, '');
  }

  async updateCustomerAfterOrder(orderData: any, tenantId: string): Promise<void> {
    try {
      await this.customersService.upsert({
        name: orderData.customerName,
        phone: orderData.phone,
        address: orderData.deliveryAddress,
        neighborhood: orderData.neighborhood,
        whatsappId: orderData.chatId || '',
        locationId: orderData.locationId,
      }, tenantId);
    } catch (err) {
      console.error('Error updating customer after order:', err);
    }
  }
} 