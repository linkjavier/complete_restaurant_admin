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

1. docker-compose up postgres
2. backend npm start (npm run build, si es necesario)
3. frontend npm run dev (npm run build, si es necesario)
4. ngrok http http://localhost:3001 (Para servir el sitio para testing)
5. curl -X POST http://localhost:3000/api/auth/login   -H "Content-Type: application/json"   -d '{"email": "javier@test.com", "password": "12345678"}'
6. curl -X GET http://localhost:3000/auth/me   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiMTgzMGQ3ZS0wMjI5LTRkZTgtOWM4ZS1hZTAxMzZjNGVhMjYiLCJlbWFpbCI6ImphdmllckB0ZXN0Mi5jb20iLCJyb2xlIjoiQURNSU4iLCJsb2NhdGlvbklkIjpudWxsLCJpYXQiOjE3NDU1NDM1NzIsImV4cCI6MTc0NTYyOTk3Mn0.9CXZ8DFfsmVFt5yxg-LPa9A2CzFH9E03J_3PsMzWvlY"

7. (Crear usuario) curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email": "javier@test.com", "password": "12345678", "firstName": "Javier", "lastName": "Test", "role": "ADMIN"}'