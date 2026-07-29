# Local Setup & Verification Guide

## Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- npm

## Backend Installation & Setup
1. Navigate to the server folder:
   ```bash
   cd server

## Install dependencies:
npm install --legacy-peer-deps

## Configure Environment Variables (.env):
DATABASE_URL="postgresql://user:password@localhost:5432/froncort_db?schema=public"
JWT_SECRET="your_jwt_secret_key"
PORT=5000

## Run Database Schema Sync & Seed Data (Applies DB Triggers):
npx prisma db push
npx prisma db seed

## Running Automated Security Tests 
## To execute automated BOLA security and AI data isolation tests:
npx jest --forceExit