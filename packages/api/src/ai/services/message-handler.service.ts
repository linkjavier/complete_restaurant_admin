import { Injectable } from '@nestjs/common';

@Injectable()
export class MessageHandlerService {
  private readonly deliveryTimeKeywords = [
    'cuanto se demora el domicilio',
    'cuánto se demora el domicilio',
    'cuanto tarda el domicilio',
    'cuánto tarda el domicilio',
    'cuanto tiempo toma el domicilio',
    'cuánto tiempo toma el domicilio',
    'tiempo de entrega',
    'tiempo domicilio',
    'demora domicilio',
    'demora del domicilio',
    'cuanto se demora el pedido',
    'cuánto se demora el pedido',
    'cuanto tarda el pedido',
    'cuánto tarda el pedido',
    'cuanto tiempo toma el pedido',
    'cuánto tiempo toma el pedido',
    'tiempo de entrega del pedido',
    'tiempo pedido',
    'demora pedido',
    'demora del pedido',
  ];

  private readonly menuKeywords = [
    'domicilio',
    'menú',
    'menu',
    'carta',
    'pedido',
    'ordenar',
    'orden',
    'pedir',
    'ver menu',
    'ver menú',
    'ver carta',
    'quiero',
    'almuerzo',
    'almuerzos',
  ];

  private readonly confirmKeywords = [
    'sí', 'si', 'confirmo', 'confirmar', 'correcto', 
    'está bien', 'ok', 'dale', 'listo', 'así está bien'
  ];

  private readonly genericWords = [
    'almuerzo', 'bebida', 'jugo', 'especial', 'ejecutivo', 
    'combo', 'plato', 'menu', 'menú', 'carta'
  ];

  normalizeText(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  isDeliveryTimeQuestion(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    return this.deliveryTimeKeywords.some(keyword => normalizedText.includes(keyword));
  }

  isMenuRequest(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    return this.menuKeywords.some(keyword => normalizedText.includes(keyword));
  }

  isConfirmation(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    return this.confirmKeywords.some(keyword => normalizedText.trim().startsWith(keyword));
  }

  isVariantPrompt(lastAssistantMessage: string): boolean {
    return lastAssistantMessage && (
      lastAssistantMessage.includes('elige una opción para cada grupo') ||
      lastAssistantMessage.includes('dime tus elecciones') ||
      lastAssistantMessage.includes('¿Qué opciones prefieres para cada uno de los grupos?')
    );
  }

  isGeneralMenuRequest(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    const generalMenuPhrases = [
      'ver menu', 'ver menú', 'ver carta', 'muéstrame el menú', 
      'muéstrame la carta', 'qué hay de almuerzo', 'qué hay para almorzar', 
      'qué tienes de almuerzo', 'opciones de almuerzo', 'opciones de menú', 
      'carta', 'menú', 'menu', 'almuerzos', 'almuerzo'
    ];
    return generalMenuPhrases.some(phrase => normalizedText.includes(phrase));
  }

  hasUsedGenericWords(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    return this.genericWords.some(word => normalizedText.includes(word));
  }

  tokenize(str: string): string[] {
    return this.normalizeText(str)
      .replace(/[()\[\],.]/g, '')
      .replace(/\b(el|la|los|las|un|una|unos|unas|de|del|a|para|con|y|o|en|al)\b/gi, '')
      .split(' ')
      .filter(Boolean);
  }

  getDeliveryTimeResponse(): string {
    return '¡Por supuesto! Normalmente los domicilios se demoran entre 20 y 30 minutos, pero puede variar según la zona y la demanda. 😊';
  }
} 