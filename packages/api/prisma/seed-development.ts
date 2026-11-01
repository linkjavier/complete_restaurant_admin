import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const tenantId = 'blondie-demo';
const demoEmail = process.env.BLONDIE_DEMO_EMAIL ?? 'demo@blondie.local';
const demoPassword = process.env.BLONDIE_DEMO_PASSWORD ?? 'BlondieDemo2026!';

const locations = [
  {
    id: 'blondie-demo-poblado',
    name: 'Blondie El Poblado',
    address: 'Dirección de prueba, El Poblado',
    phone: '+573000000001',
    order: 0,
  },
  {
    id: 'blondie-demo-laureles',
    name: 'Blondie Laureles',
    address: 'Dirección de prueba, Laureles',
    phone: '+573000000002',
    order: 1,
  },
  {
    id: 'blondie-demo-envigado',
    name: 'Blondie Envigado',
    address: 'Dirección de prueba, Envigado',
    phone: '+573000000003',
    order: 2,
  },
] as const;

const categories = [
  { id: 'blondie-demo-cat-burgers', name: 'Hamburguesas', order: 0 },
  { id: 'blondie-demo-cat-cocktails', name: 'Coctelería', order: 1 },
  { id: 'blondie-demo-cat-signature', name: 'Platos de autor', order: 2 },
  { id: 'blondie-demo-cat-sides', name: 'Acompañamientos', order: 3 },
] as const;

const products = [
  {
    id: 'blondie-demo-blondie-burger',
    slug: 'blondie-burger',
    name: 'Blondie Burguer',
    description: 'Hamburguesa de la casa con carne artesanal, queso, vegetales y salsa Blondie.',
    price: 18900,
    categoryName: categories[0].name,
    image:
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'blondie-demo-burger-autor',
    slug: 'burger-autor',
    name: 'Burguer Doble de Autor',
    description: 'Doble carne, queso madurado, cebolla caramelizada y salsa de la casa.',
    price: 25900,
    categoryName: categories[0].name,
    image:
      'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'blondie-demo-mojito-maracuya',
    slug: 'mojito-maracuya',
    name: 'Mojito de Maracuyá',
    description: 'Cóctel cítrico de maracuyá, hierbabuena y limón.',
    price: 16900,
    categoryName: categories[1].name,
    image:
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'blondie-demo-margarita',
    slug: 'margarita',
    name: 'Margarita Blondie',
    description: 'Margarita clásica de la casa, preparada al momento.',
    price: 18900,
    categoryName: categories[1].name,
    image:
      'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'blondie-demo-salmon-autor',
    slug: 'salmon-autor',
    name: 'Salmón en Costra de Hierbas',
    description: 'Salmón sellado con hierbas frescas y guarnición de temporada.',
    price: 36900,
    categoryName: categories[2].name,
    image:
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'blondie-demo-papas-trufadas',
    slug: 'papas-trufadas',
    name: 'Papas Trufadas',
    description: 'Papas doradas con parmesano y mayonesa de trufa.',
    price: 11900,
    categoryName: categories[3].name,
    image:
      'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=1000&q=85',
  },
] as const;

function assertLocalDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de Blondie solo se puede ejecutar fuera de producción.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL es obligatorio para ejecutar el seed de desarrollo.');
  }

  const parsedUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (!localHosts.has(parsedUrl.hostname) || databaseName !== 'blondie') {
    throw new Error(
      'Por seguridad, el seed solo puede ejecutarse contra la base local "blondie" (localhost).',
    );
  }

  if (demoPassword.length < 8) {
    throw new Error('BLONDIE_DEMO_PASSWORD debe tener al menos 8 caracteres.');
  }
}

async function seedDevelopmentData() {
  assertLocalDevelopmentDatabase();

  const passwordHash = await bcrypt.hash(demoPassword, 10);

  await prisma.$transaction(async (tx) => {
    const conflictingTenant = await tx.tenant.findFirst({
      where: {
        name: { equals: 'blondie', mode: 'insensitive' },
        NOT: { id: tenantId },
      },
    });

    if (conflictingTenant) {
      throw new Error(
        `Ya existe un tenant llamado "blondie" con otro ID (${conflictingTenant.id}); no se modificó.`,
      );
    }

    await tx.tenant.upsert({
      where: { id: tenantId },
      create: { id: tenantId, name: 'blondie' },
      update: { name: 'blondie' },
    });

    for (const location of locations) {
      await tx.location.upsert({
        where: { id: location.id },
        create: {
          ...location,
          tenantId,
          city: 'Medellín',
          country: 'Colombia',
        },
        update: {
          name: location.name,
          address: location.address,
          phone: location.phone,
          order: location.order,
          city: 'Medellín',
          country: 'Colombia',
        },
      });

      await tx.settings.upsert({
        where: {
          tenantId_locationId: { tenantId, locationId: location.id },
        },
        create: {
          tenantId,
          locationId: location.id,
          businessName: 'Blondie Restaurante Bar',
          aiName: 'Blondie',
          aiGender: 'female',
          aiEnabled: false,
          deliveryFee: 8000,
        },
        update: {
          businessName: 'Blondie Restaurante Bar',
          deliveryFee: 8000,
        },
      });
    }

    const categoryIds = new Map<string, string>();
    for (const category of categories) {
      const savedCategory = await tx.category.upsert({
        where: {
          tenantId_name: { tenantId, name: category.name },
        },
        create: {
          ...category,
          tenantId,
          description: `Categoría de ejemplo para ${category.name.toLowerCase()}.`,
        },
        update: {
          description: `Categoría de ejemplo para ${category.name.toLowerCase()}.`,
          order: category.order,
        },
      });
      categoryIds.set(category.name, savedCategory.id);
    }

    const primaryLocation = locations[0];
    await tx.user.upsert({
      where: {
        tenantId_email: { tenantId, email: demoEmail },
      },
      create: {
        tenantId,
        email: demoEmail,
        password: passwordHash,
        firstName: 'Admin',
        lastName: 'Blondie Demo',
        role: UserRole.SUPER_ADMIN,
        locationId: primaryLocation.id,
      },
      update: {
        password: passwordHash,
        firstName: 'Admin',
        lastName: 'Blondie Demo',
        role: UserRole.SUPER_ADMIN,
        locationId: primaryLocation.id,
      },
    });

    for (const location of locations) {
      for (const product of products) {
        const productId = `${product.id}-${location.id.replace('blondie-demo-', '')}`;
        const categoryId = categoryIds.get(product.categoryName);
        if (!categoryId) {
          throw new Error(`No se encontró la categoría ${product.categoryName}.`);
        }

        await tx.product.upsert({
          where: { id: productId },
          create: {
            id: productId,
            tenantId,
            locationId: location.id,
            categoryId,
            name: product.name,
            description: product.description,
            price: product.price,
            image: product.image,
            isActive: true,
            isFinal: false,
          },
          update: {
            locationId: location.id,
            categoryId,
            name: product.name,
            description: product.description,
            price: product.price,
            image: product.image,
            isActive: true,
          },
        });
      }
    }
  });

  console.log('Seed de Blondie completado.');
  console.log(`Tenant local: blondie (http://blondie.localhost:3001/auth/login)`);
  console.log(`Usuario: ${demoEmail}`);
  console.log(`Contraseña: ${demoPassword}`);
  console.log(`Sucursales: ${locations.length}; productos: ${products.length * locations.length}.`);
}

seedDevelopmentData()
  .catch((error: unknown) => {
    console.error('No se pudo completar el seed de Blondie:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
