import { Injectable } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { SettingsService } from '../../settings/settings.service';
import { OrdersService } from '../../orders/orders.service';
import { OrderType, OrderSource } from '../../orders/dto/create-order.dto';
import { normalizeName, getGroupEmoji, getPaymentEmoji, getPaymentDisplay, formatPrice } from '../utils/text-utils';
import { OrderStateService } from './order-state.service';
import { NLPService } from './nlp.service';
import { CustomersService } from '../../customers/customers.service';
import { OrderHandlerService } from './order-handler.service';
import Fuse from 'fuse.js';

@Injectable()
export class FunctionExecutorService {
  private nlpService: NLPService | null = null;
  private lastMenuHash: string = '';

  constructor(
    private productsService: ProductsService,
    private settingsService: SettingsService,
    private ordersService: OrdersService,
    private orderStateService: OrderStateService,
    private customersService: CustomersService,
    private orderHandler: OrderHandlerService,
  ) {}

  private async getNLPService(locationId: string, tenantId: string): Promise<NLPService> {
    const menu = await this.productsService.findAll({ locationId, tenantId });
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
    chatType: string,
    tenantId: string
  ): Promise<{ message: string; validatedItems?: any[]; totalAmount?: number; validated?: boolean; orderData?: any }> {
    console.log(`[Function Executor] Processing ${functionName} for ${chatType}`);
    
    if (chatType === 'admin') {
      return this.handleAdminFunction(functionName, functionArgs);
    }
    
    return this.handleRestaurantFunction(functionName, functionArgs, locationId, tenantId);
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

  private async handleRestaurantFunction(functionName: string, functionArgs: any, locationId: string, tenantId: string) {
    switch (functionName) {
      case 'search_products_by_name':
        return await this.searchProductsByName(functionArgs, locationId, tenantId);
      case 'get_menu':
        return await this.getMenu(locationId, tenantId);
      case 'calculate_order_subtotal':
        return await this.calculateOrderSubtotal(functionArgs, locationId, tenantId);
      case 'validate_order_before_creation':
        return await this.validateOrderBeforeCreation(functionArgs, locationId, tenantId);
      case 'create_order':
        return await this.createOrder(functionArgs, tenantId);
      default:
        return { message: `Función de restaurante no implementada: ${functionName}` };
    }
  }

  private async searchProductsByName(functionArgs: any, locationId: string, tenantId: string) {
    try {
      const { productName, locationId: searchLocationId } = functionArgs;
      const menu = await this.productsService.findAll({ locationId: searchLocationId, tenantId });
      
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

  private async getMenu(locationId: string, tenantId: string) {
    try {
      const menu = await this.productsService.findAll({ locationId, tenantId });
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

  private async calculateOrderSubtotal(functionArgs: any, locationId: string, tenantId: string) {
    try {
      const { items } = functionArgs;
      // LOG de depuración para ver el payload recibido y variantes
      console.log('[DEBUG] Payload recibido en calculateOrderSubtotal:', JSON.stringify(functionArgs, null, 2));
      if (!Array.isArray(items) || items.length === 0) {
        return { message: '❌ Error: No se proporcionaron productos válidos para calcular.' };
      }

      const menu = await this.productsService.findAll({ locationId, tenantId });
      const deliveryFee = await this.settingsService.getDeliveryFee(tenantId, locationId);
      
      // --- HIDRATAR variantes con IDs reales ANTES de cualquier cálculo ---
      const itemsWithSyncedVariants = this.syncVariantsWithIds(items, menu);
      // Validar variantes mapeadas
      for (const item of itemsWithSyncedVariants) {
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            if (!v.productVariantId) {
              const product = menu.find(p => p.id === item.productId);
              let validVariantsMsg = '';
              if (product && product.variantGroups) {
                const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(v.groupName));
                if (group) {
                  const validNames = group.variants.map(va => va.name).join(', ');
                  validVariantsMsg = `Opciones válidas para "${group.name}": ${validNames}`;
                }
              }
              throw new Error(`No se pudo identificar la variante "${v.groupName}: ${v.variantName}" para el producto "${item.productName}". ${validVariantsMsg ? validVariantsMsg : ''} Por favor, revisa tu selección o elige una opción válida.`);
            }
          }
        }
      }

      let totalAmount = 0;
      const validatedItems = [];

      for (let i = 0; i < itemsWithSyncedVariants.length; i++) {
        const item = itemsWithSyncedVariants[i];
        let matchingProducts = menu.filter(product => 
          product.name.toLowerCase().includes(item.productName.toLowerCase())
        );
        
        if (matchingProducts.length === 0) {
          return { message: `❌ Producto no encontrado: "${item.productName}"` };
        }

        // --- MEJORA: Heurística de bebida por item ---
        // Si hay más de un producto con el mismo nombre, y uno es bebida, y el item parece bebida, selecciona la bebida automáticamente
        if (matchingProducts.length > 1) {
          const beverageOptions = matchingProducts.filter(opt =>
            opt.category && opt.category.name && opt.category.name.toLowerCase().includes('bebida')
          );
          // Heurística: si el nombre del item contiene palabras típicas de bebida
          const beverageKeywords = ['chocolate', 'cafe', 'té', 'te', 'jugo', 'limonada', 'agua', 'malteada', 'bebida', 'gaseosa', 'cola', 'refresco', 'soda', 'milkshake', 'granizado', 'ponche'];
          const isLikelyBeverage = beverageKeywords.some(k => normalizeName(item.productName).includes(normalizeName(k)));
          // O si el usuario pidió exactamente una bebida por NLP
          let nlpIsBeverage = false;
          if (beverageOptions.length > 0) {
            const nlp = new NLPService(beverageOptions);
            const nlpResult = nlp.findBestProduct(item.productName);
            if (nlpResult && !Array.isArray(nlpResult)) {
              nlpIsBeverage = true;
            }
          }
          if ((isLikelyBeverage || nlpIsBeverage) && beverageOptions.length === 1) {
            // Selecciona automáticamente la bebida
            const product = beverageOptions[0];
            let variantTotal = 0;
            let variantDetails = [];
            if (item.variants && item.variants.length > 0 && product.variantGroups) {
              for (const v of item.variants) {
                const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(v.groupName));
                if (group) {
                  const variant = group.variants.find(va => normalizeName(va.name) === normalizeName(v.variantName));
                  if (variant) {
                    if (variant.price && variant.price > 0) {
                      variantTotal += variant.price;
                      variantDetails.push({ groupName: v.groupName, variantName: v.variantName, price: variant.price });
                    } else {
                      variantDetails.push({ groupName: v.groupName, variantName: v.variantName, price: 0 });
                    }
                  }
                }
              }
            }
            const subtotal = (product.price + variantTotal) * item.quantity;
            totalAmount += subtotal;
            validatedItems.push({
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: product.price + variantTotal,
              subtotal,
              variants: item.variants || [],
              variantDetails,
              notes: item.notes || '',
              variantSummary: ''
            });
            continue;
          } else if ((isLikelyBeverage || nlpIsBeverage) && beverageOptions.length > 1) {
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
          // Si la heurística no resuelve, usa NLP para desambiguar entre todos los productos
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

        // Solo hay un producto, ahora sí chequea variantes obligatorias
        const product = matchingProducts[0];
        // --- NUEVO: Flujo empresarial de variantes por subgrupo ---
        // Agrupa por variantes ya elegidas
        let subgroups = [];
        if (item.quantity > 1 && item.variants && item.variants.length > 0) {
          // Agrupa por combinación de variantes ya elegidas
          const variantKey = vArr => vArr.map(v => `${normalizeName(v.groupName)}:${normalizeName(v.variantName)}`).sort().join('|');
          const groupMap = {};
          (item.subgroups || [{ quantity: item.quantity, variants: item.variants }]).forEach(sub => {
            const key = variantKey(sub.variants);
            if (!groupMap[key]) groupMap[key] = { quantity: 0, variants: sub.variants };
            groupMap[key].quantity += sub.quantity;
          });
          subgroups = Object.values(groupMap);
        } else {
          subgroups = [{ quantity: item.quantity, variants: item.variants || [] }];
        }
        // Para cada subgrupo, verifica variantes faltantes
        for (const sub of subgroups) {
          let missingVariantGroups = [];
          if (product.variantGroups && product.variantGroups.length > 0) {
            for (const group of product.variantGroups) {
              if (group.isActive !== false && group.variants && group.variants.length > 0) {
                const userChose = sub.variants && sub.variants.some(v => normalizeName(v.groupName) === normalizeName(group.name));
                if (!userChose) {
                  missingVariantGroups.push(group);
                }
              }
            }
          }
          if (missingVariantGroups.length > 0) {
            let msg = `¡Perfecto! Para los *${sub.quantity}* *${product.name}*${sub.variants && sub.variants.length > 0 ? ` (${sub.variants.map(v => `${v.groupName}: ${v.variantName}`).join(', ')})` : ''}, necesito que elijas una opción para cada grupo:`;
            for (const group of missingVariantGroups) {
              const emoji = getGroupEmoji(group.name);
              const options = group.variants.map(v => {
                if (v.price && v.price > 0) {
                  return `${v.name} ($${formatPrice(v.price)})`;
                } else {
                  return v.name;
                }
              }).join(', ');
              msg += `\n${emoji ? emoji + ' ' : ''}*${group.name}*: ${options}`;
            }
            msg += '\n\nPor favor, dime tus elecciones para cada grupo (por ejemplo: "Proteína: Pollo asado, Ensalada: Verde").';
            return { message: msg };
          }
        }
        
        let variantTotal = 0;
        let variantDetails = [];
        if (item.variants && item.variants.length > 0 && product.variantGroups) {
          for (const v of item.variants) {
            const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(v.groupName));
            if (group) {
              const variant = group.variants.find(va => normalizeName(va.name) === normalizeName(v.variantName));
              if (variant) {
                if (variant.price && variant.price > 0) {
                  variantTotal += variant.price;
                  variantDetails.push({ groupName: v.groupName, variantName: v.variantName, price: variant.price });
                } else {
                  variantDetails.push({ groupName: v.groupName, variantName: v.variantName, price: 0 });
                }
              }
            }
          }
        }
        const subtotal = (product.price + variantTotal) * item.quantity;
        totalAmount += subtotal;
        
        validatedItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price + variantTotal,
          subtotal,
          variants: item.variants || [],
          variantDetails,
          notes: item.notes || '',
          variantSummary: ''
        });
      }

      const itemsSummary = validatedItems.map((item, index) => {
        let variantLines = '';
        if (item.variantDetails && item.variantDetails.length > 0) {
          variantLines = item.variantDetails.map(v => {
            if (v.price && v.price > 0) {
              return `   • ${v.groupName}: ${v.variantName} ($${formatPrice(v.price)})`;
            } else {
              return `   • ${v.groupName}: ${v.variantName}`;
            }
          }).join('\n');
        }
        return `${index + 1}. *${item.productName}*${variantLines ? '\n' + variantLines : ''}\n   └ ${item.quantity} × $${formatPrice(item.unitPrice)} = *$${formatPrice(item.subtotal)}*`;
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

  private async validateOrderBeforeCreation(functionArgs: any, locationId: string, tenantId: string) {
    try {
      const { items, totalAmount, customerName, deliveryAddress, phone, neighborhood, paymentMethod, chatId } = functionArgs;
      
      // --- NUEVO: Verificar si el cliente existe en la base de datos ---
      let existingCustomer = null;
      if (chatId) {
        const normalizedPhone = chatId.replace(/@c\.us$/, '').replace(/[^0-9]/g, '');
        existingCustomer = await this.customersService.findByPhone(normalizedPhone, locationId, tenantId);
      }

      // --- NUEVO: Determinar qué datos faltan o necesitan confirmación ---
      const missingFields = [];
      const customerDataToConfirm: {
        name?: string;
        deliveryAddress?: string;
        phone?: string;
        neighborhood?: string;
        paymentMethod?: string;
      } = {};

      if (!customerName) {
        if (existingCustomer?.name) {
          customerDataToConfirm.name = existingCustomer.name;
        } else {
          missingFields.push('Nombre completo');
        }
      } else {
        customerDataToConfirm.name = customerName;
      }

      if (!deliveryAddress) {
        if (existingCustomer?.address) {
          customerDataToConfirm.deliveryAddress = existingCustomer.address;
        } else {
          missingFields.push('Dirección de entrega');
        }
      } else {
        customerDataToConfirm.deliveryAddress = deliveryAddress;
      }

      if (!phone) {
        if (existingCustomer?.phone) {
          customerDataToConfirm.phone = existingCustomer.phone;
        } else {
          missingFields.push('Número de teléfono');
        }
      } else {
        customerDataToConfirm.phone = phone;
      }

      if (!neighborhood) {
        if (existingCustomer?.neighborhood) {
          customerDataToConfirm.neighborhood = existingCustomer.neighborhood;
        } else {
          missingFields.push('Barrio o sector');
        }
      } else {
        customerDataToConfirm.neighborhood = neighborhood;
      }

      if (!paymentMethod) {
        missingFields.push('Método de pago');
      } else {
        customerDataToConfirm.paymentMethod = paymentMethod;
      }

      // --- NUEVO: Si faltan datos, mostrar mensaje con datos existentes confirmados ---
      if (missingFields.length > 0) {
        let message = '';
        
        if (existingCustomer && Object.keys(customerDataToConfirm).length > 0) {
          message += `👋 ¡Hola ${existingCustomer.name}! Veo que ya tienes datos registrados:\n\n`;
          message += `✅ *Datos confirmados:*\n`;
          if (customerDataToConfirm.name) message += `• Nombre: ${customerDataToConfirm.name}\n`;
          if (customerDataToConfirm.deliveryAddress) message += `• Dirección: ${customerDataToConfirm.deliveryAddress}\n`;
          if (customerDataToConfirm.phone) message += `• Teléfono: ${customerDataToConfirm.phone}\n`;
          if (customerDataToConfirm.neighborhood) message += `• Barrio: ${customerDataToConfirm.neighborhood}\n`;
          message += `\n📝 *Necesito que me proporciones:*\n`;
        } else {
          message += `Para completar tu pedido, necesito algunos datos de entrega:\n\n`;
        }
        
        message += missingFields.map((field, index) => `${index + 1}. *${field}*`).join('\n');
        
        if (missingFields.includes('Método de pago')) {
          message += `\n\n💳 *Método de pago:* Efectivo, Tarjeta de Crédito, Tarjeta Débito, o Transferencia`;
        }
        
        message += `\n\nPor favor, proporcióname esta información. 📝`;
        
        return { message };
      }

      if (!items || items.length === 0) {
        return { message: '🚨 *Orden vacía*\n\n❌ No hay productos en la orden. Por favor, selecciona al menos un producto.' };
      }

      const deliveryFee = await this.settingsService.getDeliveryFee(tenantId, locationId);
      const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const totalWithDelivery = calculatedTotal + deliveryFee;

      const menu = await this.productsService.findAll({ locationId, tenantId });
      // --- HIDRATAR variantes con IDs reales ANTES de cualquier cálculo ---
      const itemsWithSyncedVariants = this.syncVariantsWithIds(items, menu);
      console.log('[VALIDATE ORDER] Items con variantes sincronizadas:', JSON.stringify(itemsWithSyncedVariants, null, 2));

      // --- Validar que todas las variantes estén correctamente mapeadas ---
      for (const item of itemsWithSyncedVariants) {
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            if (!v.productVariantId) {
              // Buscar variantes válidas para sugerir
              const product = menu.find(p => p.id === item.productId);
              let validVariantsMsg = '';
              if (product && product.variantGroups) {
                const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(v.groupName));
                if (group) {
                  const validNames = group.variants.map(va => va.name).join(', ');
                  validVariantsMsg = `Opciones válidas para "${group.name}": ${validNames}`;
                }
              }
              throw new Error(`No se pudo identificar la variante "${v.groupName}: ${v.variantName}" para el producto "${item.productName}". ${validVariantsMsg ? validVariantsMsg : ''} Por favor, revisa tu selección o elige una opción válida.`);
            }
          }
        }
      }

      // --- NUEVO: Calcular unitPrice y subtotal sumando variantes ---
      const itemsWithPrices = itemsWithSyncedVariants.map(item => {
        const product = menu.find(p => p.id === item.productId);
        let variantTotal = 0;
        if (item.variants && item.variants.length > 0 && product && product.variantGroups) {
          for (const v of item.variants) {
            const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(v.groupName));
            if (group) {
              const variant = group.variants.find(va => normalizeName(va.name) === normalizeName(v.variantName));
              if (variant && variant.price && variant.price > 0) {
                variantTotal += variant.price;
              }
            }
          }
        }
        const unitPrice = (product ? product.price : 0) + variantTotal;
        const subtotal = unitPrice * item.quantity;
        return {
          ...item,
          unitPrice,
          subtotal
        };
      });

      const itemsSummary = itemsWithPrices.map((item, index) => {
        let variantLines = '';
        let variantDetails = [];
        if (item.variants && item.variants.length > 0 && menu) {
          const product = menu.find(p => p.id === item.productId);
          for (const v of item.variants) {
            const group = product?.variantGroups?.find(g => normalizeName(g.name) === normalizeName(v.groupName));
            if (group) {
              const variant = group.variants.find(va => normalizeName(va.name) === normalizeName(v.variantName));
              if (variant) {
                if (variant.price && variant.price > 0) {
                  variantDetails.push({ groupName: v.groupName, variantName: v.variantName, price: variant.price });
                } else {
                  variantDetails.push({ groupName: v.groupName, variantName: v.variantName, price: 0 });
                }
              }
            }
          }
        }
        if (variantDetails.length > 0) {
          variantLines = variantDetails.map(v => {
            if (v.price && v.price > 0) {
              return `   • ${v.groupName}: ${v.variantName} ($${formatPrice(v.price)})`;
            } else {
              return `   • ${v.groupName}: ${v.variantName}`;
            }
          }).join('\n');
        }
        return `${index + 1}. *${item.productName}*${variantLines ? '\n' + variantLines : ''}\n   └ ${item.quantity} × $${formatPrice(item.unitPrice || 0)} = *$${formatPrice(item.subtotal || 0)}*`;
      }).join('\n');

      const formattedTotal = formatPrice(itemsWithPrices.reduce((sum, item) => sum + item.subtotal, 0) + deliveryFee);
      const deliveryFeeText = deliveryFee > 0 
        ? `\n🚚 *Domicilio:* $${formatPrice(deliveryFee)}` 
        : '';

      // --- NUEVO: Mensaje personalizado según si es cliente existente o nuevo ---
      let customerInfoHeader = '';
      if (existingCustomer) {
        customerInfoHeader = `👤 *Datos del Cliente (Confirmados)*\n━━━━━━━━━━━━━━━━━━━━━━━━`;
      } else {
        customerInfoHeader = `👤 *Datos del Cliente*\n━━━━━━━━━━━━━━━━━━━━━━━━`;
      }

      const customerInfo = `${customerInfoHeader}\n• *Nombre:* ${customerDataToConfirm.name}\n• *Dirección:* ${customerDataToConfirm.deliveryAddress}\n• *Teléfono:* ${customerDataToConfirm.phone}\n• *Barrio:* ${customerDataToConfirm.neighborhood}\n• *Método de pago:* ${getPaymentEmoji(customerDataToConfirm.paymentMethod)} ${getPaymentDisplay(customerDataToConfirm.paymentMethod)}`;

      const result = {
        message: `📋 *RESUMEN FINAL DE LA ORDEN*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${customerInfo}\n\n🍽️ *Detalles del Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}${deliveryFeeText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ La orden está validada y lista para crear.\n\n¿Confirmas que toda la información es correcta?\n\nResponde *\"Sí\"* o *\"Confirmo\"* para proceder con la orden.`,
        validated: true,
        orderData: {
          items: itemsWithSyncedVariants.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            variants: item.variants,
            notes: item.notes
          })),
          customerName: customerDataToConfirm.name,
          deliveryAddress: customerDataToConfirm.deliveryAddress,
          phone: customerDataToConfirm.phone,
          neighborhood: customerDataToConfirm.neighborhood,
          paymentMethod: customerDataToConfirm.paymentMethod,
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
   * Si el match exacto falla, usa NLP/Fuse.js para buscar la mejor coincidencia.
   * Si hay varias variantes similares, devuelve un mensaje de selección.
   * Si no hay ninguna, devuelve mensaje humanizado con sugerencias.
   */
  private syncVariantsWithIds(items: any[], menu: any[]): any[] {
    return items.map(item => {
      // 1. Buscar el producto por ID o por nombre (exacto o fuzzy)
      let product = item.productId ? menu.find(p => p.id === item.productId) : undefined;
      if (!product) {
        // Buscar por nombre exacto normalizado
        product = menu.find(p => normalizeName(p.name) === normalizeName(item.productName));
      }
      if (!product) {
        // Buscar por fuzzy search (Fuse.js)
        const fuse = new Fuse(menu, { keys: ['name'], threshold: 0.4 });
        const results = fuse.search(item.productName);
        if (results.length > 0) {
          product = results[0].item;
          console.warn(`[VARIANT SYNC] Producto encontrado por fuzzy: "${item.productName}" → "${product.name}"`);
        }
      }
      if (!product || !product.variantGroups) {
        // Si no se encuentra, log y error humanizado
        const opciones = menu.map(p => p.name).join(', ');
        throw new Error(`No se pudo identificar el producto "${item.productName}". Opciones válidas: ${opciones}`);
      }
      // 2. Mapear variantes como antes
      const syncedVariants = (item.variants || []).map(variant => {
        const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(variant.groupName));
        if (!group) {
          console.warn(`[VARIANT SYNC] Grupo no encontrado: "${variant.groupName}" en producto "${product.name}"`);
          return null;
        }
        let variantRecord = group.variants.find(v => normalizeName(v.name) === normalizeName(variant.variantName));
        if (!variantRecord) {
          const fuse = new Fuse(group.variants, { keys: ['name'], threshold: 0.4 });
          const results = fuse.search(variant.variantName);
          if (results.length === 1) {
            variantRecord = results[0].item;
          } else if (results.length > 1) {
            console.warn(`[VARIANT SYNC] Varias variantes similares encontradas para "${variant.variantName}" en grupo "${group.name}" del producto "${product.name}": ${results.map((r: any) => r.item.name).join(', ')}`);
            variantRecord = results[0].item;
          } else {
            console.warn(`[VARIANT SYNC] Variante no encontrada (ni fuzzy) para "${variant.variantName}" en grupo "${group.name}" del producto "${product.name}"`);
            return null;
          }
        }
        return {
          groupName: variant.groupName,
          variantName: variant.variantName,
          productVariantId: variantRecord.id
        };
      }).filter(v => v !== null);
      console.log(`[VARIANT SYNC] Producto "${product.name}": ${item.variants ? item.variants.length : 0} variantes originales, ${syncedVariants.length} sincronizadas`);
      return {
        ...item,
        productId: product.id,
        productName: product.name,
        variants: syncedVariants
      };
    });
  }

  private async createOrder(functionArgs: any, tenantId: string) {
    try {
      // --- HIDRATAR variantes con IDs reales ANTES de crear la orden ---
      const locationId = functionArgs.locationId;
      const menu = await this.productsService.findAll({ locationId, tenantId });
      const itemsWithSyncedVariants = this.syncVariantsWithIds(functionArgs.items, menu);
      for (const item of itemsWithSyncedVariants) {
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            if (!v.productVariantId) {
              const product = menu.find(p => p.id === item.productId);
              let validVariantsMsg = '';
              if (product && product.variantGroups) {
                const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(v.groupName));
                if (group) {
                  const validNames = group.variants.map(va => va.name).join(', ');
                  validVariantsMsg = `Opciones válidas para "${group.name}": ${validNames}`;
                }
              }
              throw new Error(`No se pudo identificar la variante "${v.groupName}: ${v.variantName}" para el producto "${item.productName}". ${validVariantsMsg ? validVariantsMsg : ''} Por favor, revisa tu selección o elige una opción válida.`);
            }
          }
        }
      }
      // Llama a la orden usando los items ya hidratados
      const createdOrder = await this.orderHandler.createOrder({ ...functionArgs, items: itemsWithSyncedVariants }, tenantId);
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