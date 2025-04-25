FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/web/package*.json ./packages/web/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install

COPY . .

WORKDIR /app/packages/web

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"] 