# Kutchen AI - Comprehensive Management System

<img src="https://res.cloudinary.com/djegujdt1/image/upload/v1750544639/x1zuo78uvmhfmszfrpha.png" alt="Kutchen Logo" width="300" height="auto" style="max-width: 50%; height: auto;">

Full-stack web system for comprehensive restaurant and bakery management with table service, smart QR ordering, kitchen module, ingredient-based inventory, multi-location reports, and analytics.

## 📋 Table of Contents

- [Main Features](#-main-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Installation and Configuration](#-installation-and-configuration)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Main Features

### Multi-location Management
- Centralized control of multiple locations
- Location-specific inventory management
- Consolidated and location-specific reports
- Location-specific roles and permissions

### Order System
- Table orders via QR Code
- Intuitive customer interface
- Real-time shopping cart
- Customer order history
- Colas implementadas con bull

### Kitchen Module
- Real-time kitchen dashboard (Comunicación Websocket con Nest.js)
- Instant order notifications
- Priority-based order management
- Kitchen printer integration

### POS and Cash Management
- Complete point of sale system
- Multiple payment methods
- Shift-based cash management
- Detailed financial reports

### Advanced Inventory
- Ingredient-based stock control
- Low inventory alerts
- Movement history
- Supplier integration

### Dashboard and Reports
- Real-time metrics
- Customizable reports
- Data export
- Predictive analysis

### Payment System
- Multiple payment gateway integration
- Secure online payments
- Electronic invoicing
- Automatic reconciliation

### Gamification and Loyalty
- Points program
- Personalized rewards
- Promotional campaigns
- Customer behavior analysis

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: TailwindCSS + Shadcn/ui
- **State Management**: React Query
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Storage**: Cloudinary
- **Authentication**: NextAuth.js

### Backend
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **WebSockets**: Socket.io
- **Authentication**: JWT
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest + Supertest

### Infrastructure
- **Containers**: Docker
- **Orchestration**: ----
- **CI/CD**: ----
- **Monitoring**: -----
- **Logging**: -----

### External Services
- **Storage**: Cloudinary
- **Payments**: Stripe
- **Notifications**: WebSockets
- **Analytics**: Google Analytics

## 🏗️ System Architecture

### Design Patterns
- Clean Architecture
- Domain-Driven Design (DDD)
- Event-Driven Architecture
- Microservices

### Main Components
- **API Gateway**: NestJS
- **Authentication Service**: JWT + NextAuth
- **Order Service**: WebSockets
- **Inventory Service**: PostgreSQL
- **Queue Service**: Redis (Bull)
- **Payment Service**: Stripe
- **Notification Service**: WebSockets

## 📦 Project Structure

```
kutchen-app/
├── packages/
│   ├── api/                    # Backend NestJS
│   │   ├── src/
│   │   │   ├── auth/          # Authentication and authorization
│   │   │   ├── products/      # Product management
│   │   │   ├── orders/        # Order management
│   │   │   ├── inventory/     # Inventory management
│   │   │   ├── payments/      # Payment integration
│   │   │   ├── reports/       # Report generation
│   │   │   └── websocket/     # Real-time communication
│   │   └── prisma/            # Database schema
│   ├── web/                    # Frontend Next.js
│   │   ├── src/
│   │   │   ├── app/           # Routes and pages
│   │   │   ├── components/    # Reusable components
│   │   │   ├── lib/           # Utilities and configurations
│   │   │   └── styles/        # Global styles
│   └── shared/                 # Shared types and utilities
├── docker/                     # Docker configurations
├── docs/                       # Documentation
└── scripts/                    # Utility scripts
```

## 🚀 Installation and Configuration

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker and Docker Compose
- pnpm (recommended)

### Initial Setup (New instance or Amazon Linux 2 server)

1. **Connect to your EC2 instance via SSH**
```bash
ssh -i your-key.pem ec2-user@your-public-ip
```

2. **Install GIT**
```bash
sudo yum update -y
sudo yum install git -y
git --version
```

3. **Install Docker**
```bash
sudo amazon-linux-extras enable docker
sudo yum install docker -y
```

4. **Install Docker Compose**
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
-o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

5. **Generate new SSH key in the Instance**
```bash
ssh-keygen -t ed25519 -C "javiercharria@gmail.com"
cat ~/.ssh/id_ed25519.pub
```

6. **Install Puppeteer dependencies**
```bash
sudo yum install -y \
    alsa-lib \
    atk \
    cups-libs \
    gtk3 \
    ipa-gothic-fonts \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    pango \
    xorg-x11-fonts-100dpi \
    xorg-x11-fonts-75dpi \
    xorg-x11-fonts-cyrillic \
    xorg-x11-fonts-misc \
    xorg-x11-fonts-Type1 \
    xorg-x11-utils
```

7. **Clone the repository**
```bash
git clone git@github.com:linkjavier/complete_restaurant_admin.git
cd complete_restaurant_admin.git
```

8. **Install dependencies**
```bash
npm install
```

9. **Configure environment variables**
```bash
cp .env.example .env
```

10. **Configure the databases**
```bash
docker-compose up -d postgres
```
```bash
docker-compose up -d redis
```

11. **Run migrations**
```bash
cd packages/api
npx prisma migrate dev
```

12. **Regenerate Prisma Client**
```bash
npx prisma generate --schema=packages/api/prisma/schema.prisma
```

12. **Configuración de auto start**
```bash
sudo nano /etc/systemd/system/nest-backend.service
```
```bash
[Unit]
Description=Nest Backend Service
After=docker.service
Requires=docker.service

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user
ExecStart=/home/ec2-user/start.sh
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable nest-backend.service
sudo systemctl start nest-backend.service

```
Para ver el log console actual del NEST
journalctl -u nest-backend.service -f

Ver los ultimos 100 registros
journalctl -u nest-backend.service -n 100

# Reinciiar el servicio
sudo systemctl restart nest-backend.service

### NGINX and SSL Setup

1. **Install NGINX**
```bash
sudo yum update -y
sudo amazon-linux-extras enable nginx1
sudo yum install nginx -y
```

2. **Start and enable NGINX**
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

3. **Install Certbot and dependencies**
```bash
sudo yum install -y epel-release
sudo yum install -y certbot python3-certbot-nginx
```

4. **Configure NGINX as proxy for Nest.js** 
```bash
## We use blondie as example. Use your app name
sudo nano /etc/nginx/conf.d/blondieapp.conf
```

Add the following content:
```nginx
server {
    listen 80;
    server_name blondieapp.xyz www.blondieapp.xyz;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

5. **Verify and reload NGINX**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

6. **Install HTTPS with Certbot**
```bash
sudo certbot --nginx -d blondieapp.xyz -d www.blondieapp.xyz
```

7. **Verify the setup**
Open in browser: https://blondieapp.xyz

## 💻 Development

### Start the Project

1. **Install Node.js**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

2. **Configure environment**
- Modify `main.ts` to include:
```typescript
await app.listen(port, '0.0.0.0');
```

3. **Open port 3000 in EC2 Security Group**
- Go to AWS Console
- EC2 → Instances → Select your instance
- Security tab → Click associated Security Group
- Inbound rules → Edit inbound rules
- Add new rule:
  - Type: Custom TCP
  - Port range: 3000
  - Source: 0.0.0.0/0 (for public access) or Vercel IP if restricted
- Save changes

4. **Start databases**
```bash
docker-compose up -d postgres
docker-compose up -d redis
```

5. **Start backend**
```bash
cd packages/api
pnpm start
```

6. **Start frontend**
```bash
cd packages/web
pnpm dev
```

7. **Expose backend for testing**
```bash
ngrok http http://localhost:3001
```

### Useful Commands

#### Authentication
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "javier@test.com", "password": "12345678"}'

# Get user information
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "javier@test.com",
    "password": "12345678",
    "firstName": "Javier",
    "lastName": "Test",
    "tenantName": "Javier Restaurante"
  }'
```

On the root domain, registration creates a new tenant and its first
`SUPER_ADMIN`. On a tenant subdomain, it creates an access request that the
tenant's `SUPER_ADMIN` must approve.

#### Database Management
```bash
# Reset database
npx prisma db push --force-reset

# Seed database
chmod +x ./scripts/seed-database.sh && ./scripts/seed-database.sh

# Seed database (Tambien funciona con paola2. Nuevo)
chmod +x ./scripts/seed-database-paola.sh && ./scripts/seed-database-paola.sh

# Script para manejar creación de productos con variantes. Funciona con export 3
chmod +x ./scripts/seed-database-paola3.sh && ./scripts/seed-database-paola3.sh

chmod +x ./scripts/seed_paola_multytenancy.sh && ./scripts/seed_paola_multytenancy.sh


sudo yum update -y
sudo yum install -y python3 python3-pip
pip3 install --user csvkit # Para el script multytenancy
pip3 install --upgrade csvkit
export PATH="/Library/Frameworks/Python.framework/Versions/3.11/bin:$PATH"

# Seed database with images
chmod +x ./scripts/seed-database-with-images.sh && ./scripts/seed-database-with-images.sh
```

#### Blondie development demo

With the local `blondie` database running and configured in `packages/api/.env`, run:

```bash
npm --workspace packages/api run seed:dev
```

This repeatable seed creates the `blondie` tenant, three Medellín demo locations,
business settings, four menu categories, six products with photos at each location,
and a development administrator. It only runs against a local PostgreSQL database
named `blondie` and refuses to run when `NODE_ENV=production`. It does not erase
other tenants or their data.

Development login:

- URL: `http://blondie.localhost:3001/auth/login`
- Email: `demo@blondie.local`
- Password: `BlondieDemo2026!`

Set `BLONDIE_DEMO_EMAIL` or `BLONDIE_DEMO_PASSWORD` in the API environment to
override the demo credentials before running the seed. Each run resets the
development administrator's password to the configured value.

## 🚀 Deployment

### Production Requirements
- Ubuntu 20.04+ server
- Docker and Docker Compose
- SSL certificate
- Configured domain

### Deployment Steps
1. Configure production environment variables
2. Build Docker images
3. Configure production database
4. Run migrations
5. Start services

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

- **Javier Charria Gómez** - [GitHub](https://github.com/linkjavier)
- **Email**: javier@gmail.com

---

Developed with ❤️ by Javier Charria Gómez