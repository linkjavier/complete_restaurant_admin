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
- `FACEBOOK_CLIENT_ID`: Facebook App ID
- `FACEBOOK_CLIENT_SECRET`: Facebook App Secret
- `FACEBOOK_CALLBACK_URL`: Facebook OAuth callback URL
- `FRONTEND_URL`: trusted frontend base origin (for local development, `http://localhost:3001`)

### Social login setup

Configure the Google and Meta/Facebook OAuth applications with these exact
redirect URIs (or the matching production API URLs):

- `http://localhost:3000/auth/google/callback`
- `http://localhost:3000/auth/facebook/callback`

Set the matching client ID, secret, and callback URL in the API environment.
Google must return a verified email; Facebook must grant the `email` permission.
The OAuth state carries a signed tenant and validated frontend origin, and the
API exchanges a short-lived, single-use code for the normal application session.
Registering from the root domain creates a new tenant and its first
`SUPER_ADMIN`; email/password registration and Google/Facebook registration
follow the same rule. A business name that is already in use is rejected.
After Google/Facebook business registration, the one-time login ticket redirects
the browser directly to the new tenant subdomain and completes the session
there. The user does not need to sign in again. The same verified social email
can own accounts in separate tenants.
On an existing tenant subdomain, social login only signs in accounts that
already belong to that tenant. Unknown emails create pending access requests,
not users. The direct registration form on a tenant subdomain also creates a
pending request; only that tenant's `SUPER_ADMIN` can approve it and choose a
role other than `SUPER_ADMIN`, or reject it. A rejected request may be submitted
again.
On the first visit to the admin panel, a `SUPER_ADMIN` without an assigned
location must create the tenant's first location. It is assigned to that user
in the same transaction before access to the panel continues.

Apply the access-request schema migration with:
```bash
npx prisma migrate deploy
```

## Scripts

- `npm run start`: Start production server
- `npm run start:dev`: Start development server
- `npm run build`: Build the application
- `npm run test`: Run tests
- `npm run lint`: Run linter
- `npm run format`: Format code

## License

MIT 