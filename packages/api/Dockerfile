# Usa slim en lugar de alpine por compatibilidad con Prisma
FROM node:18-slim

# Evita prompts
ENV CI=true

# Instalación de OpenSSL en el contenedor
RUN apt-get update -y && apt-get install -y openssl

# Directorio de trabajo
WORKDIR /app

# Copiar solo los package.json para aprovechar la cache de Docker
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Instala las dependencias solo de producción si es para prod
# RUN npm install --legacy-peer-deps

# Copia el resto del código
COPY . .

# Generar Prisma Client (antes de build)
WORKDIR /app/packages/api
RUN npx prisma generate

# Compilar el proyecto
RUN npm run build

# Exponer el puerto de la API
EXPOSE 3000

# Comando para ejecutar la API
CMD ["npm", "run", "start:dev"]
