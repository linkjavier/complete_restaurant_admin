const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearCustomers() {
  try {
    console.log('🗑️  Eliminando todos los clientes...\n');
    
    // Contar clientes antes de eliminar
    const customerCount = await prisma.customer.count();
    console.log(`📊 Clientes encontrados: ${customerCount}`);
    
    if (customerCount === 0) {
      console.log('✅ No hay clientes para eliminar');
      return;
    }
    
    // Eliminar todos los clientes
    const result = await prisma.customer.deleteMany({});
    
    console.log(`✅ Eliminados ${result.count} clientes exitosamente`);
    
    // Verificar que se eliminaron todos
    const remainingCount = await prisma.customer.count();
    console.log(`📊 Clientes restantes: ${remainingCount}`);
    
  } catch (error) {
    console.error('❌ Error eliminando clientes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearCustomers(); 