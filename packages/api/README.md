# Restaurant Admin API

This is the backend API for the Restaurant Admin application. It provides endpoints for managing users, locations, and authentication.

## Features

- User authentication (JWT)
- Social login (Google, Facebook)
- User management
- Location management
- Role-based access control

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update the environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start the development server:
   ```bash
   npm run start:dev
   ```

## API Documentation

Once the server is running, you can access the Swagger documentation at:
```
http://localhost:3000/api
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection URL
- `JWT_SECRET`: Secret key for JWT tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_CALLBACK_URL`: Google OAuth callback URL
- `FACEBOOK_APP_ID`: Facebook OAuth app ID
- `FACEBOOK_APP_SECRET`: Facebook OAuth app secret
- `FACEBOOK_CALLBACK_URL`: Facebook OAuth callback URL

## Scripts

- `npm run start`: Start production server
- `npm run start:dev`: Start development server
- `npm run build`: Build the application
- `npm run test`: Run tests
- `npm run lint`: Run linter
- `npm run format`: Format code

## License

MIT 