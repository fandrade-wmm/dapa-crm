# Legacy Replit to Firebase Migration Plan

## Overview
Migrate WhatsApp CRM features from legacy-replit (Express + PostgreSQL + Drizzle ORM) to current Firebase monorepo (Next.js 15 + Cloud Functions + Firestore).

## Legacy System Analysis

### Architecture
- **Backend**: Express 5, PostgreSQL, Drizzle ORM
- **Frontend**: React + Vite, Wouter routing, shadcn/ui
- **AI**: Replit AI Integrations (OpenAI-compatible)
- **Database**: PostgreSQL with tables for:
  - `whatsapp_conversations` - Customer conversations
  - `whatsapp_messages` - Chat messages
  - `crm_leads` - Kanban CRM leads
  - `bot_config` - Bot configuration
  - `bot_qa_pairs` - Training Q&A
  - `catalogues` - PDF catalogues
  - `automation_workflows` - Workflow definitions
  - `automation_steps` - Workflow steps

### Key Features
1. **WhatsApp Bot** - Receives webhooks, AI responses, Odoo integration
2. **CRM Kanban** - Drag-and-drop leads across stages (nuevos → proforma → venta → completado/perdido)
3. **Conversations** - List with search, labels, channel filters, unread counts
4. **Conversation Detail** - Full chat history, internal notes, labels, agent assignment
5. **Products** - Odoo catalog integration via XML-RPC
6. **Bot Training** - Custom Q&A pairs with drag-to-reorder
7. **Automations** - Workflow builder with triggers and actions
8. **Templates** - WhatsApp message templates CRUD
9. **Business Hours** - Per-day schedule with closed message
10. **Team Management** - User roles and conversation assignment

## Migration Strategy

### Phase 1: Core Data Models (Firestore Collections)
Create Firestore schema matching PostgreSQL tables:

**Collections:**
```
/conversations/{conversationId}
  - customerPhone: string
  - customerName: string | null
  - channel: 'whatsapp' | 'instagram'
  - labels: string[]
  - assignedAgentId: string | null
  - status: string
  - aiEnabled: boolean
  - unreadCount: number
  - lastMessage: string | null
  - lastMessageAt: timestamp
  - createdAt: timestamp
  - updatedAt: timestamp

/conversations/{conversationId}/messages/{messageId}
  - role: 'user' | 'assistant' | 'note'
  - content: string
  - createdAt: timestamp

/leads/{leadId}
  - name: string
  - phone: string | null
  - email: string | null
  - stage: 'nuevos' | 'proforma' | 'venta' | 'completado' | 'perdido'
  - value: string | null
  - notes: string | null
  - source: string | null
  - ownerId: string
  - createdAt: timestamp
  - updatedAt: timestamp

/botConfig/{configId}
  - instructions: string
  - businessHours: object
  - odooConfig: object

/botTraining/{qaId}
  - question: string
  - answer: string
  - active: boolean
  - sortOrder: number

/templates/{templateId}
  - name: string
  - category: 'utility' | 'marketing' | 'authentication'
  - content: string
  - active: boolean
```

### Phase 2: Cloud Functions (Firebase)
Migrate Express routes to Firebase Cloud Functions v2:

**Functions to implement:**
1. `getConversations` - List with filters (label, channel, search)
2. `getConversationById` - Get conversation with messages
3. `updateConversation` - Update labels, assignment, status
4. `createMessage` - Add message or internal note
5. `markAsRead` - Clear unread count
6. `getCrmLeads` - Fetch all leads
7. `createLead` - Create new lead
8. `updateLead` - Update lead (including stage for drag-and-drop)
9. `deleteLead` - Delete lead
10. `whatsappWebhookVerify` - GET webhook verification
11. `whatsappWebhook` - POST receive messages (triggers)
12. `getBotConfig` - Get bot configuration
13. `updateBotConfig` - Update instructions, business hours
14. `getBotTraining` - Get Q&A pairs
15. `updateBotTraining` - CRUD training data
16. `getProducts` - Fetch from external API (Odoo or mock)

### Phase 3: Frontend Components (Next.js)
Migrate React components to Next.js 15 App Router:

**Pages to implement:**
1. `/conversations` - List view with filters
2. `/conversations/[id]` - Detail view with chat interface
3. `/contacts` - Enhanced Kanban board with DnD
4. `/products` - Product catalog
5. `/bot-training` - Q&A management
6. `/automations` - Workflow builder
7. `/templates` - Template management
8. `/settings` - Bot config, business hours, team

**Shared Components:**
- CRM Kanban with @dnd-kit/core
- Conversation list item with badges
- Chat message bubble
- Internal note component
- Label selector
- Agent assignment dropdown
- Search and filter bar

### Phase 4: External Integrations
1. **Odoo XML-RPC** - Product catalog fetching
2. **WhatsApp Cloud API** - Send/receive messages
3. **OpenAI/Anthropic** - AI responses (replace Replit AI)

### Phase 5: Real-time Features
1. **Firestore listeners** - Real-time conversation updates
2. **Presence system** - Online agent status
3. **Typing indicators** - Show when agent is typing

## Implementation Priority

### High Priority (MVP)
1. ✅ CRM Leads Kanban (contacts page)
2. ✅ Conversations list with filters
3. ✅ Conversation detail with messages
4. ✅ WhatsApp webhook handlers
5. ✅ Basic bot configuration

### Medium Priority
1. Internal notes
2. Labels management
3. Agent assignment
4. Products catalog
5. Bot training Q&A

### Low Priority
1. Automation workflows
2. Templates management
3. Business hours
4. Instagram integration
5. Document storage

## Technical Considerations

### Database Differences
- **PostgreSQL → Firestore**: Change from relational to document model
- **Auto-increment IDs → UUIDs**: Use Firestore document IDs
- **JOINs → Subcollections**: Use subcollections for messages
- **Drizzle ORM → Firebase SDK**: Direct SDK calls

### Frontend Differences
- **Vite + Wouter → Next.js 15**: App Router with server components
- **TanStack Query**: Keep for client-side data fetching
- **shadcn/ui**: Already available, reuse components
- **@dnd-kit**: Install for drag-and-drop

### API Layer
- **Express REST → Cloud Functions**: `onCall` for RPC-style, HTTP functions for webhooks
- **Session auth → Firebase Auth**: Use `verifyAuth` middleware
- **CORS**: Handled by Firebase

## Next Steps

1. Set up Firestore security rules for collections
2. Implement high-priority Cloud Functions
3. Build CRM Kanban board component
4. Implement conversations list and detail pages
5. Add WhatsApp webhook integration
6. Deploy and test

## Files to Create/Modify

### Functions
- `functions/src/conversations/index.ts` (new)
- `functions/src/leads/index.ts` (new)
- `functions/src/whatsapp/index.ts` (new)
- `functions/src/bot/index.ts` (new)
- `firestore.rules` (update)

### Web
- `web/src/app/(dashboard)/contacts/page.tsx` (replace with Kanban)
- `web/src/app/(dashboard)/conversations/page.tsx` (replace with list)
- `web/src/app/(dashboard)/conversations/[id]/page.tsx` (new)
- `web/src/components/crm/kanban-board.tsx` (new)
- `web/src/components/conversations/conversation-list.tsx` (new)
- `web/src/components/conversations/chat-interface.tsx` (new)
- `web/src/lib/api.ts` (update with new functions)

## Dependencies to Add

### Web
```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "framer-motion": "^11.x",
  "date-fns": "^3.6.0",
  "emoji-picker-react": "^4.18.0"
}
```

### Functions
```json
{
  "openai": "^4.x" // or anthropic SDK
}
```
