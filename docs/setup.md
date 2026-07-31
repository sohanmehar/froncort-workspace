# Local Setup Guide

Project ko local setup karne ke simple steps:

## Prerequisites
- Node.js installed (v18+)
- PostgreSQL running locally ya Cloud instance

## 1. Backend Setup (`server/`)
```bash
cd server
npm install

# .env file setup inside server/
# DATABASE_URL="postgresql://postgres:password@localhost:5432/froncort_db?schema=public"
# JWT_SECRET="super-secret-key"
# PORT=5000

# Run migrations & seed baseline data
npx prisma migrate dev --name init
npx prisma db seed

# Run backend
npm run dev

## 2. Backend Setup (`client/`)
cd client
npm install

# .env.local file setup inside client/
# NEXT_PUBLIC_API_URL="http://localhost:5000/api"

# Run frontend
npm run dev