import { Injectable } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { CategoriesService } from '../../categories/categories.service';
import { MessageHandlerService } from './message-handler.service';

@Injectable()
export class MenuHandlerService {
  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
    private messageHandler: MessageHandlerService,
  ) {}

  // Utilidad para normalizar nombres (sin tildes, minúsculas, sin espacios extra)
  private normalizeName(str: string): string {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Diccionario de emojis sugeridos para grupos de variantes
  private getGroupEmoji(groupName: string): string {
    const groupEmojis = {
      'sopa': '🥣',
      'proteína': '🍗',
      'proteina': '🍗',
      'arroz': '🍚',
      'principio': '🥔',
      'ensalada': '🥗',
      'acompañamiento': '🍟',
      'bebida': '🥤',
    };
    const key = groupName.trim().toLowerCase();
    return groupEmojis[key] || '';
  }

  // Diccionario de emojis sugeridos para categorías
  private getCategoryEmoji(categoryName: string): string {
    const categoryEmojis: Record<string, string> = {
      'almuerzos': '🍛',
      'almuerzo': '🍛',
      'bebidas': '🥤',
      'bebida': '🥤',
      'panadería': '🥐',
      'panaderia': '🥐',
      'postres': '🍰',
      'postre': '🍰',
      'desayunos': '🍳',
      'desayuno': '🍳',
      'ensaladas': '🥗',
      'ensalada': '🥗',
      'acompañamientos': '🍟',
      'acompañamiento': '🍟',
      'sopas': '🥣',
      'sopa': '🥣',
      'carnes': '🥩',
      'pollo': '🍗',
      'pescados': '🐟',
      'hamburguesas': '🍔',
      'pizzas': '🍕',
      'pastas': '🍝',
      'jugos': '🧃',
      'cafés': '☕',
      'cafe': '☕',
      'cafetería': '☕',
      'cafeteria': '☕',
      'snacks': '🍪',
      'otros': '🧆',
    };
    const key = categoryName.trim().toLowerCase();
    return categoryEmojis[key] || '🍽️';
  }

  async searchProducts(text: string, locationId: string): Promise<{
    bestProduct: any;
    candidateProducts: any[];
    matchingProducts: any[];
  }> {
    const menu = await this.productsService.findAll({ locationId });
    const userTokens = this.messageHandler.tokenize(text);
    
    let bestProduct = null;
    let bestScore = 0;
    let candidateProducts = [];

    for (const product of menu) {
      const productTokens = this.messageHandler.tokenize(product.name);
      const matchCount = productTokens.filter(tk => userTokens.includes(tk)).length;
      const score = matchCount / productTokens.length + productTokens.length * 0.01;
      
      if (matchCount > 0) {
        candidateProducts.push({ product, score, matchCount });
        if (score > bestScore) {
          bestScore = score;
          bestProduct = product;
        }
      }
    }

    const matchingProducts = menu.filter(product =>
      product.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(this.messageHandler.normalizeText(text))
    );

    return { bestProduct, candidateProducts, matchingProducts };
  }

  async getMenuText(locationId: string): Promise<string> {
    const menu = await this.productsService.findAll({ locationId });
    if (!menu || menu.length === 0) {
      return 'No se encontró ningún producto en el menú para esta ubicación.';
    }

    const categoriesList = await this.categoriesService.categories({ orderBy: { order: 'asc' } });
    const categories: Record<string, { name: string; products: any[] }> = {};
    for (const cat of categoriesList) {
      categories[cat.id] = { name: cat.name, products: [] };
    }
    menu.forEach(product => {
      const catId = product.categoryId;
      if (!catId) return;
      if (!categories[catId]) {
        categories[catId] = { name: '', products: [] };
      }
      categories[catId].products.push(product);
    });

    let menuText = '🍽️ *Menú del Restaurante*\n';
    let prodCount = 1;
    for (const cat of categoriesList) {
      const group = categories[cat.id];
      if (!group || group.products.length === 0) continue;
      const emoji = this.getCategoryEmoji(group.name);
      menuText += `\n\n${emoji} *${group.name}*`;
      for (const product of group.products) {
        const price = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        menuText += `\n${prodCount}. *${product.name}* - $${price}`;
        if (product.variantGroups && product.variantGroups.length > 0) {
          for (const groupVar of product.variantGroups) {
            const filteredVariants = groupVar.variants.filter(v => !v.name.trim().toLowerCase().startsWith('sin '));
            if (filteredVariants.length > 0) {
              menuText += `\n   _${groupVar.name}_:`;
              for (const v of filteredVariants) {
                let variantLine = ` ${v.name}`;
                if (v.price && v.price > 0) {
                  const variantPrice = v.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                  variantLine += ` (+$${variantPrice})`;
                }
                menuText += variantLine;
              }
            }
          }
        }
        prodCount++;
      }
    }
    menuText += '\n\n*¿Qué te gustaría pedir hoy?* 😊';
    return menuText;
  }

  formatProductResponse(product: any, selectedVariants: any[] = []): string {
    const formattedPrice = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    let response = `✅ *Producto Encontrado*\n\n🍽️ *${product.name}*\n💰 *Precio:* *$${formattedPrice}*`;
    
    if (product.variantGroups && product.variantGroups.length > 0) {
      for (const groupVar of product.variantGroups) {
        const filteredVariants = groupVar.variants.filter(v => !v.name.trim().toLowerCase().startsWith('sin '));
        const emoji = this.getGroupEmoji(groupVar.name);
        if (filteredVariants.length > 0) {
          response += `\n   ${emoji} *${groupVar.name}:*`;
          for (const v of filteredVariants) {
            let variantLine = ` *${v.name}*`;
            if (v.price && v.price > 0) {
              const variantPrice = v.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              variantLine += ` (+$${variantPrice})`;
            }
            response += `\n     •${variantLine}`;
          }
        }
      }
    }
    
    response += '\n\n¿*Te gustaría pedir* este producto o necesitas más información?';
    return response;
  }

  formatProductList(products: any[]): string {
    let response = `🔍 *Búsqueda de Producto*\n\nSe encontraron *${products.length}* productos que coinciden con tu búsqueda:`;
    products.forEach((product, idx) => {
      const formattedPrice = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      response += `\n${idx + 1}. *${product.name}* - *$${formattedPrice}*`;
    });
    response += '\n\n¿*Te gustaría pedir* alguno de estos productos?';
    return response;
  }

  formatCandidateProducts(candidateProducts: any[]): string {
    let response = '🔍 *Opciones encontradas:*\n';
    candidateProducts.sort((a, b) => b.score - a.score);
    candidateProducts.forEach(({ product }, idx) => {
      const formattedPrice = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      response += `\n${idx + 1}. *${product.name}* - *$${formattedPrice}*`;
    });
    response += '\n\n*Por favor, dime el nombre o número de la opción que deseas.*';
    return response;
  }
} 