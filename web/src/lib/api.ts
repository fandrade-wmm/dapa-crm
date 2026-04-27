import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// ---------- Types ----------

export type CrmStage = 'nuevos' | 'proforma' | 'venta' | 'completado' | 'perdido';

export interface CrmLead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  stage: CrmStage;
  notes?: string | null;
  value?: string | null;
  source?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateLeadInput = Omit<CrmLead, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
export type UpdateLeadInput = Partial<Omit<CrmLead, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>;

// ---------- Templates ----------

export interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  language: string;
  isActive: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateTemplateInput = Omit<Template, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
export type UpdateTemplateInput = Partial<CreateTemplateInput> & { id: string };

// ---------- Quick Responses ----------

export interface QuickResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  sortOrder: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateQuickResponseInput = Omit<QuickResponse, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
export type UpdateQuickResponseInput = Partial<CreateQuickResponseInput> & { id: string };

// ---------- Leads API ----------

const getLeadsFn = httpsCallable<{ limit?: number; startAfter?: string }, CrmLead[]>(
  functions,
  'getLeads'
);
const createLeadFn = httpsCallable<CreateLeadInput, CrmLead>(functions, 'createLead');
const updateLeadFn = httpsCallable<{ id: string } & UpdateLeadInput, CrmLead>(
  functions,
  'updateLead'
);
const deleteLeadFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'deleteLead'
);

export const leadsApi = {
  getAll: async (): Promise<CrmLead[]> => {
    const result = await getLeadsFn({ limit: 500 });
    return result.data;
  },
  create: async (lead: CreateLeadInput): Promise<CrmLead> => {
    const result = await createLeadFn(lead);
    return result.data;
  },
  update: async (id: string, updates: UpdateLeadInput): Promise<CrmLead> => {
    const result = await updateLeadFn({ id, ...updates });
    return result.data;
  },
  delete: async (id: string): Promise<void> => {
    await deleteLeadFn({ id });
  },
};

// ---------- Templates API ----------

const getTemplatesFn = httpsCallable<Record<string, never>, Template[]>(
  functions,
  'getTemplates'
);
const createTemplateFn = httpsCallable<CreateTemplateInput, Template>(
  functions,
  'createTemplate'
);
const updateTemplateFn = httpsCallable<UpdateTemplateInput, Template>(
  functions,
  'updateTemplate'
);
const deleteTemplateFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'deleteTemplate'
);

export const templatesApi = {
  getAll: async (): Promise<Template[]> => {
    const result = await getTemplatesFn({});
    return result.data;
  },
  create: async (template: CreateTemplateInput): Promise<Template> => {
    const result = await createTemplateFn(template);
    return result.data;
  },
  update: async (updates: UpdateTemplateInput): Promise<Template> => {
    const result = await updateTemplateFn(updates);
    return result.data;
  },
  delete: async (id: string): Promise<void> => {
    await deleteTemplateFn({ id });
  },
};

// ---------- Quick Responses API ----------

const getQuickResponsesFn = httpsCallable<Record<string, never>, QuickResponse[]>(
  functions,
  'getQuickResponses'
);
const createQuickResponseFn = httpsCallable<CreateQuickResponseInput, QuickResponse>(
  functions,
  'createQuickResponse'
);
const updateQuickResponseFn = httpsCallable<UpdateQuickResponseInput, QuickResponse>(
  functions,
  'updateQuickResponse'
);
const deleteQuickResponseFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'deleteQuickResponse'
);

export const quickResponsesApi = {
  getAll: async (): Promise<QuickResponse[]> => {
    const result = await getQuickResponsesFn({});
    return result.data;
  },
  create: async (qr: CreateQuickResponseInput): Promise<QuickResponse> => {
    const result = await createQuickResponseFn(qr);
    return result.data;
  },
  update: async (updates: UpdateQuickResponseInput): Promise<QuickResponse> => {
    const result = await updateQuickResponseFn(updates);
    return result.data;
  },
  delete: async (id: string): Promise<void> => {
    await deleteQuickResponseFn({ id });
  },
};

// ---------- Stats API ----------

export interface DashboardStats {
  todayConversations: number;
  totalConversations: number;
  totalUnread: number;
  totalMessages: number;
  botEnabled: boolean;
}

const getStatsFn = httpsCallable<Record<string, never>, DashboardStats>(functions, 'getStats');
const toggleBotFn = httpsCallable<{ botEnabled: boolean }, { botEnabled: boolean }>(
  functions,
  'toggleBot'
);

export const statsApi = {
  getStats: async (): Promise<DashboardStats> => {
    const result = await getStatsFn({});
    return result.data;
  },
  toggleBot: async (botEnabled: boolean): Promise<{ botEnabled: boolean }> => {
    const result = await toggleBotFn({ botEnabled });
    return result.data;
  },
};

// ---------- Conversations ----------

export interface Conversation {
  id: string;
  customerPhone: string;
  customerName: string | null;
  contactId?: string;
  status: 'active' | 'resolved';
  aiEnabled: boolean;
  labels: string[];
  unreadCount: number;
  channel: 'whatsapp' | 'instagram';
  lastMessage: string | null;
  ownerId: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'note';
  mediaUrl?: string;
  filename?: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export type ConversationChannel = 'all' | 'whatsapp' | 'instagram';
export type ConversationStatus = 'all' | 'active' | 'resolved';

const getConversationsFn = httpsCallable<
  { search?: string; channel?: ConversationChannel; status?: ConversationStatus; limit?: number },
  Conversation[]
>(functions, 'getConversations');

const getConversationFn = httpsCallable<{ id: string }, ConversationWithMessages>(
  functions,
  'getConversation'
);

const sendMessageFn = httpsCallable<
  { conversationId: string; content: string },
  ConversationMessage
>(functions, 'sendMessage');

const addNoteFn = httpsCallable<
  { conversationId: string; content: string },
  ConversationMessage
>(functions, 'addNote');

const toggleConversationAIFn = httpsCallable<
  { conversationId: string; aiEnabled: boolean },
  { aiEnabled: boolean }
>(functions, 'toggleConversationAI');

const updateConversationLabelsFn = httpsCallable<
  { conversationId: string; labels: string[] },
  { labels: string[] }
>(functions, 'updateConversationLabels');

const markConversationReadFn = httpsCallable<
  { conversationId: string },
  { success: boolean }
>(functions, 'markConversationRead');

const assignConversationFn = httpsCallable<
  { conversationId: string; assignedTo: string | null; assignedToName: string | null },
  { assignedTo: string | null; assignedToName: string | null }
>(functions, 'assignConversation');

export const conversationsApi = {
  getAll: async (params?: {
    search?: string;
    channel?: ConversationChannel;
    status?: ConversationStatus;
  }): Promise<Conversation[]> => {
    const result = await getConversationsFn({ limit: 100, ...params });
    return result.data;
  },
  getById: async (id: string): Promise<ConversationWithMessages> => {
    const result = await getConversationFn({ id });
    return result.data;
  },
  sendMessage: async (conversationId: string, content: string): Promise<ConversationMessage> => {
    const result = await sendMessageFn({ conversationId, content });
    return result.data;
  },
  addNote: async (conversationId: string, content: string): Promise<ConversationMessage> => {
    const result = await addNoteFn({ conversationId, content });
    return result.data;
  },
  toggleAI: async (conversationId: string, aiEnabled: boolean): Promise<{ aiEnabled: boolean }> => {
    const result = await toggleConversationAIFn({ conversationId, aiEnabled });
    return result.data;
  },
  updateLabels: async (conversationId: string, labels: string[]): Promise<{ labels: string[] }> => {
    const result = await updateConversationLabelsFn({ conversationId, labels });
    return result.data;
  },
  markRead: async (conversationId: string): Promise<{ success: boolean }> => {
    const result = await markConversationReadFn({ conversationId });
    return result.data;
  },
  assign: async (
    conversationId: string,
    assignedTo: string | null,
    assignedToName: string | null
  ): Promise<{ assignedTo: string | null; assignedToName: string | null }> => {
    const result = await assignConversationFn({ conversationId, assignedTo, assignedToName });
    return result.data;
  },
};

// ---------- Active Agents (lightweight, any auth user) ----------

export interface AgentInfo {
  id: string;
  displayName: string | null;
  email: string;
}

const getActiveAgentsFn = httpsCallable<Record<string, never>, AgentInfo[]>(functions, 'getActiveAgents');

export const agentsApi = {
  getAll: async (): Promise<AgentInfo[]> => {
    const result = await getActiveAgentsFn({});
    return result.data;
  },
};

// ---------- Team ----------

export interface TeamMember {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'agent';
  permissions: {
    conversations: boolean;
    crm: boolean;
    automations: boolean;
    quickResponses: boolean;
    settings: boolean;
  };
  isActive: boolean;
  createdAt: string;
  inviteLink?: string;
}

export interface InviteTeamMemberInput {
  email: string;
  displayName: string;
  role: 'admin' | 'agent';
  permissions?: Partial<TeamMember['permissions']>;
}

export type UpdateTeamMemberInput = Partial<
  Pick<TeamMember, 'role' | 'permissions' | 'isActive'>
> & { id: string };

const getTeamFn = httpsCallable<Record<string, never>, TeamMember[]>(functions, 'getTeam');
const inviteTeamMemberFn = httpsCallable<InviteTeamMemberInput, TeamMember & { inviteLink: string }>(
  functions,
  'inviteTeamMember'
);
const updateTeamMemberFn = httpsCallable<UpdateTeamMemberInput, TeamMember>(
  functions,
  'updateTeamMember'
);
const removeTeamMemberFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'removeTeamMember'
);

export const teamApi = {
  getAll: async (): Promise<TeamMember[]> => {
    const result = await getTeamFn({});
    return result.data;
  },
  invite: async (input: InviteTeamMemberInput): Promise<TeamMember & { inviteLink: string }> => {
    const result = await inviteTeamMemberFn(input);
    return result.data;
  },
  update: async (input: UpdateTeamMemberInput): Promise<TeamMember> => {
    const result = await updateTeamMemberFn(input);
    return result.data;
  },
  remove: async (id: string): Promise<void> => {
    await removeTeamMemberFn({ id });
  },
};

// ---------- Automations ----------

export type AutomationTriggerType = 'message_received' | 'keyword_match' | 'time_based';
export type AutomationActionType = 'send_message' | 'assign_agent' | 'add_label';

export interface AutomationTrigger {
  type: AutomationTriggerType;
  conditions?: Record<string, unknown>;
}

export interface AutomationAction {
  type: AutomationActionType;
  params?: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  isActive: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateAutomationInput = Omit<Automation, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
export type UpdateAutomationInput = Partial<CreateAutomationInput> & { id: string };

const getAutomationsFn = httpsCallable<Record<string, never>, Automation[]>(
  functions,
  'getAutomations'
);
const createAutomationFn = httpsCallable<CreateAutomationInput, Automation>(
  functions,
  'createAutomation'
);
const updateAutomationFn = httpsCallable<UpdateAutomationInput, Automation>(
  functions,
  'updateAutomation'
);
const deleteAutomationFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'deleteAutomation'
);

export const automationsApi = {
  getAll: async (): Promise<Automation[]> => {
    const result = await getAutomationsFn({});
    return result.data;
  },
  create: async (input: CreateAutomationInput): Promise<Automation> => {
    const result = await createAutomationFn(input);
    return result.data;
  },
  update: async (input: UpdateAutomationInput): Promise<Automation> => {
    const result = await updateAutomationFn(input);
    return result.data;
  },
  delete: async (id: string): Promise<void> => {
    await deleteAutomationFn({ id });
  },
};

// ---------- Clients (Contacts) ----------

export interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  cedulaRuc: string | null;
  email: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  address: string | null;
  city: string | null;
  company: string | null;
  tags: string[];
  source: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateContactInput = {
  firstName: string;
  lastName?: string | null;
  cedulaRuc?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  company?: string | null;
  tags?: string[];
};

export type UpdateContactInput = Partial<CreateContactInput> & { id: string };

const getContactsFn = httpsCallable<{ limit?: number; search?: string }, Contact[]>(functions, 'getContacts');
const getContactByPhoneFn = httpsCallable<{ phone: string }, Contact | null>(functions, 'getContactByPhone');
const createContactFn = httpsCallable<CreateContactInput, Contact>(functions, 'createContact');
const updateContactFn = httpsCallable<UpdateContactInput, Contact>(functions, 'updateContact');
const deleteContactFn = httpsCallable<{ id: string }, { success: boolean }>(functions, 'deleteContact');
const deduplicateContactsFn = httpsCallable<Record<string, never>, { merged: number; deleted: number }>(functions, 'deduplicateContacts');

export const clientsApi = {
  getAll: async (search?: string): Promise<Contact[]> => {
    const result = await getContactsFn({ limit: 200, search });
    return result.data;
  },
  getByPhone: async (phone: string): Promise<Contact | null> => {
    const result = await getContactByPhoneFn({ phone });
    return result.data;
  },
  create: async (input: CreateContactInput): Promise<Contact> => {
    const result = await createContactFn(input);
    return result.data;
  },
  update: async (input: UpdateContactInput): Promise<Contact> => {
    const result = await updateContactFn(input);
    return result.data;
  },
  delete: async (id: string): Promise<void> => {
    await deleteContactFn({ id });
  },
  deduplicate: async (): Promise<{ merged: number; deleted: number }> => {
    const result = await deduplicateContactsFn({});
    return result.data;
  },
};

// ---------- Catalogs ----------

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateCatalogInput = Pick<Catalog, 'name' | 'fileUrl' | 'fileName'> & {
  description?: string;
};

const getCatalogsFn = httpsCallable<Record<string, never>, Catalog[]>(functions, 'getCatalogs');
const createCatalogFn = httpsCallable<CreateCatalogInput, Catalog>(functions, 'createCatalog');
const updateCatalogFn = httpsCallable<{ id: string; name?: string; description?: string | null }, Catalog>(
  functions,
  'updateCatalog'
);
const deleteCatalogFn = httpsCallable<{ id: string }, { success: boolean }>(functions, 'deleteCatalog');

export const catalogsApi = {
  getAll: async (): Promise<Catalog[]> => {
    const result = await getCatalogsFn({});
    return result.data;
  },
  create: async (input: CreateCatalogInput): Promise<Catalog> => {
    const result = await createCatalogFn(input);
    return result.data;
  },
  update: async (id: string, updates: { name?: string; description?: string | null }): Promise<Catalog> => {
    const result = await updateCatalogFn({ id, ...updates });
    return result.data;
  },
  delete: async (id: string): Promise<void> => {
    await deleteCatalogFn({ id });
  },
};

// ---------- Send Media ----------

export type MediaType = 'image' | 'video' | 'document' | 'audio';

export interface SendMediaInput {
  mediaUrl: string;
  mediaType: MediaType;
  caption?: string;
  filename?: string;
}

const sendMediaFn = httpsCallable<{ conversationId: string } & SendMediaInput, { id: string; sent: boolean }>(
  functions,
  'sendMedia'
);

export const mediaApi = {
  send: async (conversationId: string, input: SendMediaInput): Promise<{ id: string; sent: boolean }> => {
    const result = await sendMediaFn({ conversationId, ...input });
    return result.data;
  },
};

// ---------- Whapi / WhatsApp ----------

export type WhapiStatus = 'active' | 'loading' | 'qr' | 'offline' | 'not_configured';

export interface WhapiStatusResult {
  status: WhapiStatus;
  phone?: string;
  name?: string;
  qrCode?: string;
}

export const whapiApi = {
  getStatus: async (): Promise<WhapiStatusResult> => {
    const res = await fetch('/api/whatsapp/status');
    if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
    return res.json() as Promise<WhapiStatusResult>;
  },
};
