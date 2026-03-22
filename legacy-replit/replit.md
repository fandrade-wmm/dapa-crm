# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is a WhatsApp AI chatbot system for DAPA Home, an Ecuadorian home decor and lighting store. The bot answers customer questions in Spanish using real-time product data from Odoo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Replit AI Integrations (OpenAI-compatible, gpt-5.2)
- **Odoo integration**: XML-RPC via `xmlrpc` package

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (WhatsApp webhook, Odoo, AI)
│   └── whatsapp-dashboard/ # React + Vite dashboard (Spanish UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/ # Server-side AI client
│   └── integrations-openai-ai-react/  # React AI hooks
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Features

### 8 New Features (added March 2026)
- **Real-time notifications**: Unread count badge on Conversations nav, polls `/api/stats` every 20s
- **Labels**: Tag conversations with Interesado, Cotización enviada, Compró, Seguimiento, Sin stock, VIP — filter on list page + add/remove in ConversationDetail header
- **Agent assignment**: Assign conversations to team members via dropdown in ConversationDetail header
- **Internal notes**: Amber-colored sticky notes (not sent to WhatsApp) — StickyNote mode in chat footer
- **WhatsApp Templates**: Full CRUD at `/templates` — categories: utility, marketing, authentication; copy-to-clipboard; active/inactive toggle
- **Dashboard stats**: Recharts BarChart (messages per day inbound/outbound) + PieChart (by label); stat cards for today/total/unread/messages
- **Mark as read**: Auto-marks conversation as read on open, decrements unread counter
- **Business hours**: Settings > Horario tab — per-day enable/start/end time + closed message; toggle enabled/disabled globally

### WhatsApp Bot
- Receives messages via Meta webhook at `POST /api/whatsapp/webhook`
- Webhook verification at `GET /api/whatsapp/webhook`
- Fetches relevant products from Odoo in real-time
- Generates Spanish responses using gpt-5.2
- Stores all conversations in PostgreSQL
- Business hours check before AI response (respects Guayaquil timezone)

### Odoo Integration
- Connects to https://www.dapahome.ec via XML-RPC
- Database: dapahome.ec
- Fetches products with name, price, stock, category
- 2,166 total products, categories: Iluminación, Cintas LED, Spots, Focos, etc.

### Dashboard (Spanish UI)
- Dashboard: conversation stats + Odoo/WhatsApp status
- Conversaciones: all WhatsApp threads with full message history
- Productos: live product catalog from Odoo
- Configuración: webhook URL for Meta setup + bot simulator

## API Endpoints

- `GET /api/healthz` — health check
- `GET /api/whatsapp/webhook` — Meta webhook verification
- `POST /api/whatsapp/webhook` — receive WhatsApp messages
- `GET /api/bot/status` — bot status (Odoo + WhatsApp configured?)
- `POST /api/bot/test` — test the AI bot with a message
- `GET /api/conversations` — list all conversations
- `GET /api/conversations/:id` — get conversation with messages
- `GET /api/products?search=&limit=&offset=` — Odoo product catalog

## Environment Variables

- `ODOO_URL` — https://www.dapahome.ec
- `ODOO_DB` — dapahome.ec
- `ODOO_USERNAME` — fandradec@hotmail.com
- `ODOO_API_KEY` — (secret) Odoo API key
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI key
- `WHATSAPP_VERIFY_TOKEN` — token for Meta webhook verification (set to: dapahome_verify_token)
- `WHATSAPP_ACCESS_TOKEN` — (secret) Meta WhatsApp access token (set after Meta setup)
- `WHATSAPP_PHONE_NUMBER_ID` — (secret) WhatsApp phone number ID (set after Meta setup)

## WhatsApp Setup (Next Steps)

1. Create Meta app at developers.facebook.com
2. Add WhatsApp product
3. Get Phone Number ID and Access Token
4. Set `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` as secrets
5. In Meta dashboard, set webhook URL to: `https://<your-domain>/api/whatsapp/webhook`
6. Set verify token to: `dapahome_verify_token`
7. Subscribe to `messages` event

## Database Schema

- `whatsapp_conversations` — customer phone, name, status, timestamps
- `whatsapp_messages` — conversationId, role (user/assistant), content, timestamp
- `crm_leads` — CRM Kanban leads with stage, contact info, value, notes
- `bot_config` — custom bot instructions (single row)
- `bot_qa_pairs` — training Q&A pairs with active toggle and sort order
- `catalogues` — uploaded PDF catalogue metadata (name, description, objectPath, filename, size)

## Object Storage

GCS-backed object storage (App Storage) is provisioned. Environment secrets set:
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- `PUBLIC_OBJECT_SEARCH_PATHS`
- `PRIVATE_OBJECT_DIR`

API endpoints:
- `POST /api/storage/uploads/request-url` — get presigned GCS upload URL
- `GET /api/storage/objects/*` — serve uploaded files
- `GET /api/catalogues` — list catalogues
- `POST /api/catalogues` — save catalogue metadata after upload
- `DELETE /api/catalogues/:id` — delete catalogue record
- `POST /api/whatsapp/send-document` — send PDF to a WhatsApp number

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
