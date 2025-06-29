import { Injectable } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { OrderType, OrderSource } from '../../orders/dto/create-order.dto';
import { CustomerContextService } from './customer-context.service';

@Injectable()
export class OrderHandlerService {
  constructor(
    private ordersService: OrdersService,
    private customerContext: CustomerContextService,
  ) {}

  async createOrder(orderData: any): Promise<{ id: string }> {
    const createdOrder = await this.ordersService.create({
      items: orderData.items,
      customerName: orderData.customerName,
      deliveryAddress: orderData.deliveryAddress,
      phone: orderData.phone,
      neighborhood: orderData.neighborhood,
      paymentMethod: orderData.paymentMethod,
      locationId: orderData.locationId,
      deliveryFee: orderData.deliveryFee || 0,
      type: OrderType.DELIVERY,
      source: OrderSource.WHATSAPP,
    });

    // Update customer data after order creation
    await this.customerContext.updateCustomerAfterOrder(orderData);

    return createdOrder;
  }

  validateOrderData(orderData: any): { isValid: boolean; missingFields: string[] } {
    const requiredFields = ['customerName', 'deliveryAddress', 'phone', 'neighborhood', 'paymentMethod'];
    const missingFields = requiredFields.filter(field => !orderData[field]);
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  formatOrderSuccessMessage(orderId: string): string {
    return `✅ ¡Tu orden ha sido creada exitosamente!\n\nNúmero de orden: *${orderId}*\n\nPronto recibirás la confirmación de tu pedido. ¡Gracias por confiar en nosotros!`;
  }

  formatOrderErrorMessage(error: any): string {
    return `❌ Error creando la orden: ${error.message}`;
  }

  formatMissingFieldsMessage(missingFields: string[]): string {
    const fieldNames = {
      customerName: 'nombre completo',
      deliveryAddress: 'dirección de entrega',
      phone: 'número de teléfono',
      neighborhood: 'barrio o sector',
      paymentMethod: 'método de pago'
    };

    const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
    
    return `Por favor, proporciona los siguientes datos antes de confirmar la orden: ${missingFieldNames.join(', ')}.`;
  }
} 