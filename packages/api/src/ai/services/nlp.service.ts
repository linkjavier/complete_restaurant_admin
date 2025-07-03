// Cambia la importación para compatibilidad universal
const Fuse = require('fuse.js');

export class NLPService {
  private fuse: any;
  private synonymMap: Record<string, string[]> = {
    'Chocolate': ['chocolate para tomar', 'chocolate bebida', 'chocolate caliente', 'chocolate drink', 'chocolate bebida caliente'],
    'Croissant de Chocolate': ['croissant chocolate', 'croissant de chocolate', 'croissant relleno de chocolate'],
    // Agrega más productos y sinónimos aquí
  };

  constructor(products: any[]) {
    // Agrega sinónimos a los productos
    const extendedProducts = products.flatMap(product => {
      const synonyms = this.synonymMap[product.name] || [];
      return [product, ...synonyms.map(syn => ({ ...product, name: syn }))];
    });
    this.fuse = new Fuse(extendedProducts, {
      keys: ['name'],
      threshold: 0.4, // Ajusta para más o menos tolerancia
    });
  }

  findBestProduct(userInput: string) {
    const results = this.fuse.search(userInput);
    if (results.length === 1) return results[0].item;
    if (results.length > 1) return results.map(r => r.item);
    return null;
  }
} 