// Script de prueba para verificar la función calculate_order_subtotal
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCalculateOrderSubtotal() {
  try {
    console.log('🔍 Probando la función calculate_order_subtotal...');
    
    // 1. Verificar conexión a la base de datos
    console.log('📊 Verificando conexión a la base de datos...');
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos exitosa');
    
    // 2. Obtener una ubicación
    console.log('📍 Buscando ubicaciones...');
    const locations = await prisma.location.findMany();
    console.log(`✅ Encontradas ${locations.length} ubicaciones:`, locations.map(l => ({ id: l.id, name: l.name })));
    
    if (locations.length === 0) {
      console.error('❌ No hay ubicaciones en la base de datos');
      return;
    }
    
    const locationId = locations[0].id;
    console.log(`📍 Usando ubicación: ${locationId} (${locations[0].name})`);
    
    // 3. Obtener productos de esa ubicación
    console.log('🍽️ Buscando productos...');
    const products = await prisma.product.findMany({
      where: { locationId },
      include: { category: true }
    });
    
    console.log(`✅ Encontrados ${products.length} productos:`);
    products.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.name} - $${product.price} (${product.category?.name || 'Sin categoría'})`);
    });
    
    if (products.length === 0) {
      console.error('❌ No hay productos en esta ubicación');
      return;
    }
    
    // 4. Simular la función calculate_order_subtotal
    console.log('\n🧮 Simulando cálculo de subtotal...');
    const testItems = [
      { productName: products[0].name, quantity: 2 },
      { productName: products[1]?.name || products[0].name, quantity: 1 }
    ];
    
    console.log('📋 Items de prueba:', testItems);
    
    const validatedItems = [];
    let totalAmount = 0;
    const errors = [];

    for (const item of testItems) {
      console.log(`🔍 Procesando: ${item.productName}`);
      
      const matchingProducts = products.filter(product => 
        product.name.toLowerCase().includes(item.productName.toLowerCase())
      );
      
      console.log(`  Encontrados ${matchingProducts.length} productos coincidentes`);
      
      if (matchingProducts.length === 0) {
        errors.push(`❌ Producto no encontrado: "${item.productName}"`);
        continue;
      }

      if (matchingProducts.length > 1) {
        errors.push(`❌ Múltiples productos coinciden con "${item.productName}"`);
        continue;
      }

      const product = matchingProducts[0];
      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;
      
      console.log(`  ✅ ${product.name} - ${item.quantity} × $${product.price} = $${subtotal}`);

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: subtotal,
        notes: ''
      });
    }

    console.log('\n📊 Resultados:');
    console.log(`  Errores: ${errors.length}`);
    console.log(`  Items validados: ${validatedItems.length}`);
    console.log(`  Total: $${totalAmount}`);
    
    if (errors.length > 0) {
      console.log('❌ Errores encontrados:', errors);
    } else {
      console.log('✅ Cálculo exitoso!');
      
      // Mostrar resumen formateado
      const itemsSummary = validatedItems.map((item, index) => 
        `${index + 1}. *${item.productName}*\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`
      ).join('\n');

      const formattedTotal = totalAmount.toLocaleString('es-CO', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      });

      console.log('\n📋 *Resumen de tu Pedido*');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(itemsSummary);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`💰 *Total a pagar: $${formattedTotal}*`);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la prueba
testCalculateOrderSubtotal(); 