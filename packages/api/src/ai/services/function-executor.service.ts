import { Injectable } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { SettingsService } from '../../settings/settings.service';
import { OrdersService } from '../../orders/orders.service';
import { OrderType, OrderSource } from '../../orders/dto/create-order.dto';
import { normalizeName, getGroupEmoji, getPaymentEmoji, getPaymentDisplay, formatPrice } from '../utils/text-utils';
import { OrderStateService } from './order-state.service';
import { NLPService } from './nlp.service';

@Injectable()
export class FunctionExecutorService {
  private nlpService: NLPService | null = null;
  private lastMenuHash: string = '';

  constructor(
    private productsService: ProductsService,
    private settingsService: SettingsService,
    private ordersService: OrdersService,
    private orderStateService: OrderStateService,
  ) {}

  private async getNLPService(locationId: string): Promise<NLPService> {
    const menu = await this.productsService.findAll({ locationId });
    const menuHash = JSON.stringify(menu.map(p => p.id + p.name + p.price)).substring(0, 1000); // simple hash
    if (!this.nlpService || this.lastMenuHash !== menuHash) {
      this.nlpService = new NLPService(menu);
      this.lastMenuHash = menuHash;
    }
    return this.nlpService;
  }

  async executeFunction(
    functionName: string, 
    functionArgs: any, 
    locationId: string, 
    chatType: string
  ): Promise<{ message: string; validatedItems?: any[]; totalAmount?: number; validated?: boolean; orderData?: any }> {
    console.log(`[Function Executor] Processing ${functionName} for ${chatType}`);
    
    if (chatType === 'admin') {
      return this.handleAdminFunction(functionName, functionArgs);
    }
    
    return this.handleRestaurantFunction(functionName, functionArgs, locationId);
  }

  private handleAdminFunction(functionName: string, functionArgs: any) {
    switch (functionName) {
      case 'get_sales_report':
        return { message: 'Generando reporte de ventas para el período especificado...' };
      case 'get_inventory_status':
        return { message: 'Verificando estado del inventario...' };
      case 'get_staff_performance':
        return { message: 'Generando métricas de rendimiento del personal...' };
      default:
        return { message: `Función administrativa no implementada: ${functionName}` };
    }
  }

  private async handleRestaurantFunction(functionName: string, functionArgs: any, locationId: string) {
    switch (functionName) {
      case 'search_products_by_name':
        return await this.searchProductsByName(functionArgs, locationId);
      case 'get_menu':
        return await this.getMenu(locationId);
      case 'calculate_order_subtotal':
        return await this.calculateOrderSubtotal(functionArgs, locationId);
      case 'validate_order_before_creation':
        return await this.validateOrderBeforeCreation(functionArgs, locationId);
      case 'create_order':
        return await this.createOrder(functionArgs);
      default:
        return { message: `Función de restaurante no implementada: ${functionName}` };
    }
  }

  private async searchProductsByName(functionArgs: any, locationId: string) {
    try {
      const { productName, locationId: searchLocationId } = functionArgs;
      const menu = await this.productsService.findAll({ locationId: searchLocationId });
      
      const matchingProducts = menu.filter(product => 
        product.name.toLowerCase().includes(productName.toLowerCase())
      );

      if (matchingProducts.length === 0) {
        return {
          message: `🔍 *Búsqueda de Producto*\n\n❌ No se encontraron productos que coincidan con *"${productName}"*.\n\nPor favor, verifica el nombre del producto o intenta con una palabra clave diferente.`
        };
      }

      if (matchingProducts.length === 1) {
        const product = matchingProducts[0];
        const formattedPrice = formatPrice(product.price);
        return {
          message: `✅ *Producto Encontrado*\n\n🍽️ *${product.name}*\n💰 Precio: *$${formattedPrice}*\n🆔 ID: \`${product.id}\`\n\n¡Perfecto! Este producto está disponible.`
        };
      }

      const productList = matchingProducts.map((product, index) => {
        const formattedPrice = formatPrice(product.price);
        return `${index + 1}. *${product.name}*\n   💰 $${formattedPrice} | 🆔 \`${product.id}\``;
      }).join('\n');

      return {
        message: `🔍 *Búsqueda de Producto*\n\nSe encontraron *${matchingProducts.length}* productos que coinciden con *"${productName}"*:\n\n${productList}\n\nPor favor, especifica mejor el nombre del producto para obtener un resultado más preciso.`
      };
    } catch (error) {
      console.error('Error in search_products_by_name:', error);
      return { message: `❌ Error buscando productos: ${error.message}` };
    }
  }

  private async getMenu(locationId: string) {
    try {
      const menu = await this.productsService.findAll({ locationId });
      if (!menu || menu.length === 0) {
        return { message: 'No se encontró ningún producto en el menú para esta ubicación.' };
      }

      let menuText = '🍽️ *Menú del Restaurante*\n';
      let prodCount = 1;
      
      for (const product of menu) {
        const price = formatPrice(product.price);
        menuText += `\n${prodCount}. *${product.name}* - $${price}`;
        prodCount++;
      }
      
      return { message: menuText };
    } catch (error) {
      console.error('Error in get_menu:', error);
      return { message: `❌ Error mostrando el menú: ${error.message}` };
    }
  }

  private async calculateOrderSubtotal(functionArgs: any, locationId: string) {
    try {
      const { items } = functionArgs;
      // LOG de depuración para ver el payload recibido y variantes
      console.log('[DEBUG] Payload recibido en calculateOrderSubtotal:', JSON.stringify(functionArgs, null, 2));
      if (!Array.isArray(items) || items.length === 0) {
        return { message: '❌ Error: No se proporcionaron productos válidos para calcular.' };
      }

      const menu = await this.productsService.findAll({ locationId });
      const deliveryFee = await this.settingsService.getDeliveryFee();
      
      let totalAmount = 0;
      const validatedItems = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const matchingProducts = menu.filter(product => 
          product.name.toLowerCase().includes(item.productName.toLowerCase())
        );
        
        if (matchingProducts.length === 0) {
          return { message: `❌ Producto no encontrado: "${item.productName}"` };
        }
        
        if (matchingProducts.length > 1) {
          // --- Heurística de negocio: si hay panadería y chocolate, prioriza bebida ---
          const bakeryKeywords = ['pan', 'pandebono', 'almojábana', 'arepa', 'buñuelo', 'panadería', 'pastelería'];
          const hasBakery = items.some(it => bakeryKeywords.some(k => it.productName.toLowerCase().includes(k)));
          const beverageOptions = matchingProducts.filter(opt =>
            opt.category && opt.category.name && opt.category.name.toLowerCase().includes('bebida')
          );
          if (hasBakery && beverageOptions.length === 1) {
            // Selecciona automáticamente la bebida
            const product = beverageOptions[0];
            const subtotal = product.price * item.quantity;
            totalAmount += subtotal;
            validatedItems.push({
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: product.price,
              subtotal,
              variants: item.variants || [],
              notes: item.notes || '',
              variantSummary: ''
            });
            continue;
          } else if (hasBakery && beverageOptions.length > 1) {
            // Si hay varias bebidas, pregunta solo por las bebidas
            if (functionArgs.conversationId && this.orderStateService) {
              this.orderStateService.updateState(functionArgs.conversationId, {
                pendingProductSelection: {
                  originalItems: items,
                  ambiguousIndex: i,
                  options: beverageOptions
                }
              });
            }
            const options = beverageOptions.map((product, idx) =>
              `${idx + 1}. *${product.name}* - $${formatPrice(product.price)}`
            ).join('\n');
            return {
              message: `🔎 He encontrado varias bebidas que coinciden con *"${item.productName}"*:\n\n${options}\n\nPor favor, dime el número o el nombre exacto de la bebida que deseas. 😊`
            };
          }
          // Si la heurística no resuelve, usa NLP para desambiguar
          if (functionArgs.conversationId && this.orderStateService) {
            this.orderStateService.updateState(functionArgs.conversationId, {
              pendingProductSelection: {
                originalItems: items,
                ambiguousIndex: i,
                options: matchingProducts
              }
            });
          }
          const options = matchingProducts.map((product, idx) =>
            `${idx + 1}. *${product.name}* - $${formatPrice(product.price)}`
          ).join('\n');
          return {
            message: `🔎 He encontrado varios productos que coinciden con *"${item.productName}"*:\n\n${options}\n\nPor favor, dime el número o el nombre exacto del producto que deseas. 😊`
          };
        }

        const product = matchingProducts[0];
        const subtotal = product.price * item.quantity;
        totalAmount += subtotal;
        
        validatedItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          subtotal,
          variants: item.variants || [],
          notes: item.notes || '',
          variantSummary: ''
        });
      }

      const itemsSummary = validatedItems.map((item, index) => {
        let variantLines = '';
        if (item.variants && item.variants.length > 0) {
          variantLines = item.variants.map(v => `   • ${v.groupName}: ${v.variantName}`).join('\n');
        }
        return `${index + 1}. *${item.productName}*${variantLines ? '\n' + variantLines : ''}\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`;
      }).join('\n');

      const formattedTotal = formatPrice(totalAmount + deliveryFee);
      const deliveryFeeText = deliveryFee > 0 
        ? `\n🚚 *Domicilio:* $${formatPrice(deliveryFee)}` 
        : '';

      const response = `📋 *Resumen de tu Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}${deliveryFeeText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ Todos los productos fueron validados correctamente.\n\n¿Deseas agregar algo más a tu orden o procedemos con tus datos de entrega?`;

      return {
        message: response,
        validatedItems,
        totalAmount: totalAmount + deliveryFee
      };
    } catch (error) {
      console.error('Error in calculate_order_subtotal:', error);
      return { message: `❌ Error calculando subtotales: ${error.message}. Por favor, intenta de nuevo.` };
    }
  }

  private async validateOrderBeforeCreation(functionArgs: any, locationId: string) {
    try {
      const { items, totalAmount, customerName, deliveryAddress, phone, neighborhood, paymentMethod } = functionArgs;
      
      if (!customerName || !deliveryAddress || !phone || !neighborhood || !paymentMethod) {
        return {
          message: `Para completar tu pedido, necesito algunos datos de entrega:\n\n1. *Nombre completo*\n2. *Dirección de entrega*\n3. *Número de teléfono*\n4. *Barrio o sector*\n5. *Método de pago* (Efectivo, Tarjeta de Crédito, Tarjeta Débito, o Transferencia)\n\nPor favor, proporcióname esta información. 📝`
        };
      }

      if (!items || items.length === 0) {
        return { message: '🚨 *Orden vacía*\n\n❌ No hay productos en la orden. Por favor, selecciona al menos un producto.' };
      }

      const deliveryFee = await this.settingsService.getDeliveryFee();
      const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const totalWithDelivery = calculatedTotal + deliveryFee;

      const menu = await this.productsService.findAll({ locationId });
      const itemsWithSyncedVariants = this.syncVariantsWithIds(items, menu);
      console.log('[VALIDATE ORDER] Items con variantes sincronizadas:', JSON.stringify(itemsWithSyncedVariants, null, 2));

      const itemsSummary = itemsWithSyncedVariants.map((item, index) => {
        let variantLines = '';
        if (item.variants && item.variants.length > 0) {
          variantLines = item.variants.map(v => `   • ${v.groupName}: ${v.variantName}`).join('\n');
        }
        return `${index + 1}. *${item.productName}*${variantLines ? '\n' + variantLines : ''}\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`;
      }).join('\n');

      const formattedTotal = formatPrice(totalWithDelivery);
      const deliveryFeeText = deliveryFee > 0 
        ? `\n🚚 *Domicilio:* $${formatPrice(deliveryFee)}` 
        : '';

      const customerInfo = `👤 *Datos del Cliente*\n━━━━━━━━━━━━━━━━━━━━━━━━\n• *Nombre:* ${customerName}\n• *Dirección:* ${deliveryAddress}\n• *Teléfono:* ${phone}\n• *Barrio:* ${neighborhood}\n• *Método de pago:* ${getPaymentEmoji(paymentMethod)} ${getPaymentDisplay(paymentMethod)}`;

      const result = {
        message: `📋 *RESUMEN FINAL DE LA ORDEN*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${customerInfo}\n\n🍽️ *Detalles del Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}${deliveryFeeText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ La orden está validada y lista para crear.\n\n¿Confirmas que toda la información es correcta?\n\nResponde *\"Sí\"* o *\"Confirmo\"* para proceder con la orden.`,
        validated: true,
        orderData: {
          items: itemsWithSyncedVariants.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            variants: item.variants || [],
            notes: item.notes
          })),
          customerName,
          deliveryAddress,
          phone,
          neighborhood,
          paymentMethod,
          locationId,
          deliveryFee
        }
      };

      return result;
    } catch (error) {
      console.error('Error in validate_order_before_creation:', error);
      return { message: `❌ Error validando la orden: ${error.message}` };
    }
  }

  /**
   * Sincroniza las variantes del usuario con sus IDs reales en la base de datos
   * @param items - Items del pedido con variantes
   * @param menu - Menú completo con variantes
   * @returns Items con variantes sincronizadas a IDs reales
   */
  private syncVariantsWithIds(items: any[], menu: any[]): any[] {
    return items.map(item => {
      if (!item.variants || item.variants.length === 0) {
        return item;
      }

      // Encontrar el producto en el menú
      const product = menu.find(p => p.id === item.productId);
      if (!product || !product.variantGroups) {
        console.warn(`[VARIANT SYNC] Producto no encontrado o sin grupos de variantes: ${item.productName}`);
        return { ...item, variants: [] }; // Sin variantes si no se encuentra
      }

      const syncedVariants = item.variants.map(variant => {
        // Buscar el grupo de variantes por nombre normalizado
        const group = product.variantGroups.find(g => 
          normalizeName(g.name) === normalizeName(variant.groupName)
        );

        if (!group) {
          console.warn(`[VARIANT SYNC] Grupo no encontrado: "${variant.groupName}" en producto "${product.name}"`);
          return null;
        }

        // Buscar la variante específica por nombre normalizado
        const variantRecord = group.variants.find(v => 
          normalizeName(v.name) === normalizeName(variant.variantName)
        );

        if (!variantRecord) {
          console.warn(`[VARIANT SYNC] Variante no encontrada: "${variant.variantName}" en grupo "${group.name}" del producto "${product.name}"`);
          return null;
        }

        // Retornar la variante con el ID real
        return {
          groupName: variant.groupName,
          variantName: variant.variantName,
          productVariantId: variantRecord.id
        };
      }).filter(v => v !== null); // Filtrar variantes que no se pudieron mapear

      console.log(`[VARIANT SYNC] Producto "${product.name}": ${item.variants.length} variantes originales, ${syncedVariants.length} sincronizadas`);

      return {
        ...item,
        variants: syncedVariants
      };
    });
  }

  private async createOrder(functionArgs: any) {
    try {
      const deliveryFee = await this.settingsService.getDeliveryFee();
      
      // Las variantes ya están sincronizadas en validateOrderBeforeCreation
      console.log('[CREATE ORDER] Items recibidos (variantes ya sincronizadas):', JSON.stringify(functionArgs.items, null, 2));

      const createdOrder = await this.ordersService.create({
        items: functionArgs.items,
        customerName: functionArgs.customerName,
        deliveryAddress: functionArgs.deliveryAddress,
        phone: functionArgs.phone,
        neighborhood: functionArgs.neighborhood,
        paymentMethod: functionArgs.paymentMethod,
        locationId: functionArgs.locationId,
        deliveryFee: functionArgs.deliveryFee || deliveryFee || 0,
        type: OrderType.DELIVERY,
        source: OrderSource.WHATSAPP,
      });

      return {
        message: `✅ ¡Tu orden ha sido creada exitosamente!\n\nNúmero de orden: *${createdOrder.id}*\n\nPronto recibirás la confirmación de tu pedido. ¡Gracias por confiar en nosotros!`,
        validated: true
      };
    } catch (error) {
      console.error('Error in create_order:', error);
      return { message: `❌ Error creando la orden: ${error.message}` };
    }
  }
} 