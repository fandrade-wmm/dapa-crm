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
  status: 'active' | 'resolved';
  aiEnabled: boolean;
  labels: string[];
  unreadCount: number;
  channel: 'whatsapp' | 'instagram';
  lastMessage: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'image' | 'video' | 'document' | 'note';
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
};
