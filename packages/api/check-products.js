const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
    try {
        const tenant = await prisma.tenant.findFirst({ where: { name: { contains: 'paola', mode: 'insensitive' } } });
        if (!tenant) {
            console.log('Tenant "paola" not found.');
            return;
        }

        console.log(`Checking products for tenant ${tenant.name} (${tenant.id}):`);

        const locations = await prisma.location.findMany({
            where: { tenantId: tenant.id },
            select: { id: true, name: true, city: true }
        });

        console.log('\nLocations:');
        locations.forEach(l => console.log(`- ${l.name} (${l.id}) in ${l.city}`));

        const products = await prisma.product.findMany({
            where: {
                tenantId: tenant.id,
                name: { contains: 'Caja Valluna', mode: 'insensitive' }
            },
            select: { id: true, name: true, locationId: true }
        });

        console.log('\nProducts matching "Caja Valluna":');
        if (products.length === 0) {
            console.log('No products found.');
        } else {
            products.forEach(p => {
                const loc = locations.find(l => l.id === p.locationId);
                console.log(`- ${p.name} (ID: ${p.id}) at location: ${loc ? loc.name : p.locationId}`);
            });
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkProducts();
