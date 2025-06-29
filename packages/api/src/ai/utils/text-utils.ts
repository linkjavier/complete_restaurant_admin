// Utilidad para normalizar nombres (sin tildes, minúsculas, sin espacios extra)
export function normalizeName(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Utilidad para obtener todas las variantes de todos los grupos
export function getAllVariants(product: any): any[] {
  if (!product.variantGroups) return [];
  return product.variantGroups.flatMap(g => g.variants || []);
}

// Diccionario de emojis sugeridos para grupos de variantes
export function getGroupEmoji(groupName: string): string {
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

// Mapear métodos de pago a emojis
export function getPaymentEmoji(paymentMethod: string): string {
  const paymentEmojis = {
    'CASH': '💵',
    'CREDIT_CARD': '💳',
    'DEBIT_CARD': '💳',
    'TRANSFER': '🏦'
  };
  return paymentEmojis[paymentMethod] || '';
}

// Mapear métodos de pago a nombres legibles
export function getPaymentDisplay(paymentMethod: string): string {
  const paymentDisplay = {
    'CASH': 'Efectivo',
    'CREDIT_CARD': 'Tarjeta de Crédito',
    'DEBIT_CARD': 'Tarjeta Débito',
    'TRANSFER': 'Transferencia'
  };
  return paymentDisplay[paymentMethod] || paymentMethod;
}

// Formatear precio en formato colombiano
export function formatPrice(price: number): string {
  return price.toLocaleString('es-CO', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
} 