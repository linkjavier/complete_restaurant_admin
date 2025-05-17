# Blondie Restaurante Bar - Sistema de Gestión Integral

![Blondie Logo](https://res.cloudinary.com/djegujdt1/image/upload/v1746047136/blondie-logo.png)

Sistema web full stack para la gestión integral de restaurante y panadería con servicio a la mesa, pedidos inteligentes con QR, módulo de cocina, inventario por ingredientes, reportes y analíticas multi-sede.

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Desarrollo](#-desarrollo)
- [Despliegue](#-despliegue)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

## 🚀 Características Principales

### Gestión Multi-sede
- Control centralizado de múltiples ubicaciones
- Gestión de inventario por sede
- Reportes consolidados y por ubicación
- Roles y permisos específicos por sede

### Sistema de Pedidos
- Pedidos desde mesa vía Código QR
- Interfaz intuitiva para clientes
- Carrito de compras en tiempo real
- Historial de pedidos por cliente

### Módulo de Cocina
- Dashboard en tiempo real para cocina
- Notificaciones instantáneas de pedidos
- Gestión de órdenes por prioridad
- Integración con impresoras de cocina

### POS y Gestión de Caja
- Sistema de punto de venta completo
- Múltiples métodos de pago
- Gestión de caja por turno
- Reportes financieros detallados

### Inventario Avanzado
- Control de stock por ingredientes
- Alertas de inventario bajo
- Historial de movimientos
- Integración con proveedores

### Dashboard y Reportes
- Métricas en tiempo real
- Reportes personalizables
- Exportación de datos
- Análisis predictivo

### Sistema de Pagos
- Integración con múltiples pasarelas
- Pagos en línea seguros
- Facturación electrónica
- Conciliación automática

### Gamificación y Fidelización
- Programa de puntos
- Recompensas personalizadas
- Campañas promocionales
- Análisis de comportamiento del cliente

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: TailwindCSS + Shadcn/ui
- **Estado**: React Query + Zustand
- **Formularios**: React Hook Form + Zod
- **Gráficos**: Recharts
- **Almacenamiento**: Cloudinary
- **Autenticación**: NextAuth.js

### Backend
- **Framework**: NestJS
- **Lenguaje**: TypeScript
- **ORM**: Prisma
- **Base de Datos**: PostgreSQL
- **WebSockets**: Socket.io
- **Autenticación**: JWT
- **Documentación**: Swagger/OpenAPI
- **Testing**: Jest + Supertest

### Infraestructura
- **Contenedores**: Docker
- **Orquestación**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoreo**: Prometheus + Grafana
- **Logging**: ELK Stack

### Servicios Externos
- **Almacenamiento**: Cloudinary
- **Pagos**: Stripe
- **Notificaciones**: WebSockets
- **Analytics**: Google Analytics

## 🏗️ Arquitectura del Sistema

### Patrones de Diseño
- Clean Architecture
- Domain-Driven Design (DDD)
- Event-Driven Architecture
- Microservicios

### Componentes Principales
- **API Gateway**: NestJS
- **Servicio de Autenticación**: JWT + NextAuth
- **Servicio de Pedidos**: WebSockets
- **Servicio de Inventario**: PostgreSQL
- **Servicio de Pagos**: Stripe
- **Servicio de Notificaciones**: WebSockets

## 📦 Estructura del Proyecto

```
blondie-restaurant-bar/
├── packages/
│   ├── api/                    # Backend NestJS
│   │   ├── src/
│   │   │   ├── auth/          # Autenticación y autorización
│   │   │   ├── products/      # Gestión de productos
│   │   │   ├── orders/        # Gestión de pedidos
│   │   │   ├── inventory/     # Gestión de inventario
│   │   │   ├── payments/      # Integración de pagos
│   │   │   ├── reports/       # Generación de reportes
│   │   │   └── websocket/     # Comunicación en tiempo real
│   │   └── prisma/            # Esquema de base de datos
│   ├── web/                    # Frontend Next.js
│   │   ├── src/
│   │   │   ├── app/           # Rutas y páginas
│   │   │   ├── components/    # Componentes reutilizables
│   │   │   ├── lib/           # Utilidades y configuraciones
│   │   │   └── styles/        # Estilos globales
│   └── shared/                 # Tipos y utilidades compartidas
├── docker/                     # Configuraciones de Docker
├── docs/                       # Documentación
└── scripts/                    # Scripts de utilidad
```

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js 18+
- PostgreSQL 14+
- Docker y Docker Compose
- pnpm (recomendado)

### Configuración Inicial

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/linkjavier/blondie-restaurant-bar.git
   cd blondie-restaurant-bar
   ```

2. Instalar dependencias:
   ```bash
   pnpm install
   ```

3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```

4. Configurar la base de datos:
   ```bash
   docker-compose up -d postgres
   ```

5. Ejecutar migraciones:
   ```bash
   cd packages/api
   pnpm prisma migrate dev
   ```

## 💻 Desarrollo

### Iniciar el Proyecto

1. Iniciar las bases de datos:
   ```bash
   docker-compose up postgres
   ```
   ```bash
   docker-compose up redis
   ```

2. Iniciar el backend:
   ```bash
   cd packages/api
   pnpm start
   ```

3. Iniciar el frontend:
   ```bash
   cd packages/web
   pnpm dev
   ```

4. Exponer el backend para testing:
   ```bash
   ngrok http http://localhost:3001
   ```

### Comandos Útiles

#### Autenticación
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "javier@test.com", "password": "12345678"}'

# Obtener información del usuario
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Crear usuario
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "javier@test.com",
    "password": "12345678",
    "firstName": "Javier",
    "lastName": "Test",
    "role": "ADMIN"
  }'
```

# Limpiar la base de datos
```bash
npx prisma db push --force-reset
```

# Alimentar la base de datos
```bash
chmod +x ./scripts/seed-database.sh && ./scripts/seed-database.sh
```

## 🚀 Despliegue

### Requisitos de Producción
- Servidor con Ubuntu 20.04+
- Docker y Docker Compose
- Certificado SSL
- Dominio configurado

### Pasos de Despliegue
1. Configurar variables de entorno de producción
2. Construir imágenes Docker
3. Configurar base de datos de producción
4. Ejecutar migraciones - npx prisma migrate dev --name init
5. Iniciar servicios

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

- **Javier Charria Gómez** - [GitHub](https://github.com/linkjavier)
- **Email**: javier@test.com

---

Desarrollado con ❤️ por Javier Charria Gómez