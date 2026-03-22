# CRM Assistant

CRM App Assistant that helps you manage your business. Omnichannel for all marketing tools, connect your database and let AI help you grow and manage your business.

## Overview

A full-stack Firebase application built with:

- **Frontend** — Next.js 14+ (App Router) with TypeScript, TailwindCSS, and shadcn/ui
- **Backend** — Firebase Cloud Functions with TypeScript and Firebase Admin SDK
- **Database** — Cloud Firestore
- **Auth** — Firebase Authentication
- **Storage** — Firebase Storage

---

## Monorepo Structure

```
crm-assistant/
├── web/          # Next.js App Router frontend
└── functions/    # Firebase Cloud Functions backend
```

---

## Prerequisites

- Node.js 20 (use `nvm use` with the included `.nvmrc`)
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Web-My-Money/crm-assistant.git
cd crm-assistant
nvm use
```

### 2. Install dependencies

```bash
# Frontend
cd web
npm install

# Backend
cd ../functions
npm install
```

### 3. Configure environment variables

```bash
cp web/.env.example web/.env.local
# Fill in your Firebase project credentials in web/.env.local
```

### 4. Login to Firebase

```bash
firebase login
firebase use default
```

---

## Running Locally (with Emulators)

```bash
# Start Firebase emulators (from repo root)
firebase emulators:start

# In a separate terminal, start the Next.js dev server
cd web
npm run dev
```

The app will be available at `http://localhost:3000`.

Emulator UIs:
- Firestore: `http://localhost:4000`
- Auth: `http://localhost:9099`
- Functions: `http://localhost:5001`

---

## Deployment

```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS + shadcn/ui |
| State / Data fetching | React Query |
| Validation | Zod |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Backend | Firebase Cloud Functions (Node 20) |
| Admin SDK | firebase-admin |

