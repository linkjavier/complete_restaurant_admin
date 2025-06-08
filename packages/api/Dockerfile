# Usa la imagen oficial de Node.js (Linux)
FROM node:20

ENV CI=true
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/restaurant_admin?schema=public"
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379

# Establecemos el directorio de trabajo principal
WORKDIR /app

# Copiamos el package.json de la API
COPY package.json ./
COPY packages/api/package.json ./

# Instalamos dependencias
RUN npm cache clean --force && \
    npm install --legacy-peer-deps

# Copiamos el schema de Prisma y generamos el cliente
COPY packages/api/prisma ./prisma/
RUN npx prisma generate

# Copiamos el código fuente de la API
COPY packages/api/src ./src/
COPY packages/api/tsconfig*.json ./

# Recompilamos bcrypt para Linux y construimos la aplicación
RUN npm rebuild bcrypt --build-from-source && \
    npm run build

EXPOSE 3000
CMD ["npm", "run", "start:dev"]