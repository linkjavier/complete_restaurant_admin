# Blondie Restaurante Bar - Sistema de Gestión

Sistema web full stack para la gestión integral de restaurante y panadería con servicio a la mesa, pedidos inteligentes con QR, módulo de cocina, inventario por ingredientes, reportes y analíticas multi-sede.

## 🚀 Características Principales

- Gestión Multi-sede
- Pedidos desde Mesa vía Código QR
- Módulo de Cocina en tiempo real
- POS y Gestión de Caja
- Inventario Avanzado
- Dashboard y Reportes
- Sistema de Pagos Integrado
- Gamificación y Fidelización

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js (App Router) + TailwindCSS + React Query
- **Backend**: Nest.js + Prisma + PostgreSQL
- **Infraestructura**: Docker + Kubernetes
- **Autenticación**: Auth0 / Firebase Auth
- **Notificaciones**: WebSockets

## 📦 Estructura del Proyecto

```
blondie-restaurant-bar/
├── packages/
│   ├── api/           # Backend NestJS
│   ├── web/           # Frontend Next.js
│   └── shared/        # Shared types and utilities
├── docker/            # Docker configurations
└── docs/             # Documentation
```

## 🚀 Iniciar el Proyecto

1. Clonar el repositorio
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```
4. Iniciar en modo desarrollo:
   ```bash
   npm run dev
   ```

## 📝 Licencia

MIT 

Manual Exec

En root, $ npm run dev
en /packages/api $npm start