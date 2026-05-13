import { createClient } from '@/lib/supabase/client';

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

export const leadsApi = {
  getAll: async (): Promise<CrmLead[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? null,
      email: r.email ?? null,
      stage: r.stage as CrmStage,
      notes: r.notes ?? null,
      value: r.value ?? null,
      source: r.source ?? null,
      ownerId: r.owner_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },
  create: async (lead: CreateLeadInput): Promise<CrmLead> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...lead, owner_id: user!.id })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, phone: data.phone ?? null, email: data.email ?? null, stage: data.stage as CrmStage, notes: data.notes ?? null, value: data.value ?? null, source: data.source ?? null, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  update: async (id: string, updates: UpdateLeadInput): Promise<CrmLead> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, phone: data.phone ?? null, email: data.email ?? null, stage: data.stage as CrmStage, notes: data.notes ?? null, value: data.value ?? null, source: data.source ?? null, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------- Templates API ----------

export const templatesApi = {
  getAll: async (): Promise<Template[]> => {
    const supabase = createClient();
    const { data, error } = await supabase.from('templates').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id, name: r.name, category: r.category, content: r.content,
      language: r.language, isActive: r.is_active,
      ownerId: r.owner_id, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  },
  create: async (template: CreateTemplateInput): Promise<Template> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...template, is_active: template.isActive, owner_id: user!.id })
      .select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, category: data.category, content: data.content, language: data.language, isActive: data.is_active, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  update: async (updates: UpdateTemplateInput): Promise<Template> => {
    const supabase = createClient();
    const { id, ...rest } = updates;
    const { data, error } = await supabase
      .from('templates')
      .update({ ...rest, ...(rest.isActive !== undefined ? { is_active: rest.isActive } : {}), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, category: data.category, content: data.content, language: data.language, isActive: data.is_active, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------- Quick Responses API ----------

export const quickResponsesApi = {
  getAll: async (): Promise<QuickResponse[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('quick_responses')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('title');
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id, title: r.title, content: r.content, category: r.category,
      sortOrder: r.sort_order, ownerId: r.owner_id,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  },
  create: async (qr: CreateQuickResponseInput): Promise<QuickResponse> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('quick_responses')
      .insert({ title: qr.title, content: qr.content, category: qr.category, sort_order: qr.sortOrder, owner_id: user!.id })
      .select().single();
    if (error) throw error;
    return { id: data.id, title: data.title, content: data.content, category: data.category, sortOrder: data.sort_order, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  update: async (updates: UpdateQuickResponseInput): Promise<QuickResponse> => {
    const supabase = createClient();
    const { id, ...rest } = updates;
    const { data, error } = await supabase
      .from('quick_responses')
      .update({ ...rest, ...(rest.sortOrder !== undefined ? { sort_order: rest.sortOrder } : {}), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return { id: data.id, title: data.title, content: data.content, category: data.category, sortOrder: data.sort_order, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('quick_responses').delete().eq('id', id);
    if (error) throw error;
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

export const statsApi = {
  getStats: async (): Promise<DashboardStats> => {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalConvs, todayConvs, unreadRows, totalMsgs, botCfg] = await Promise.all([
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('conversations').select('unread_count').gt('unread_count', 0),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('bot_config').select('bot_enabled').eq('id', 1).single(),
    ]);
    const totalUnread = (unreadRows.data ?? []).reduce((sum: number, c: { unread_count: number }) => sum + (c.unread_count ?? 0), 0);
    return {
      totalConversations: totalConvs.count ?? 0,
      todayConversations: todayConvs.count ?? 0,
      totalUnread,
      totalMessages: totalMsgs.count ?? 0,
      botEnabled: botCfg.data?.bot_enabled ?? false,
    };
  },
  toggleBot: async (botEnabled: boolean): Promise<{ botEnabled: boolean }> => {
    const supabase = createClient();
    const { error } = await supabase.from('bot_config').update({ bot_enabled: botEnabled }).eq('id', 1);
    if (error) throw error;
    return { botEnabled };
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

function mapMessage(r: Record<string, unknown>): ConversationMessage {
  return {
    id: r.id as string,
    role: r.role as 'user' | 'assistant',
    content: r.content as string,
    messageType: r.message_type as ConversationMessage['messageType'],
    mediaUrl: (r.media_url as string) || undefined,
    filename: (r.filename as string) || undefined,
    isInternalNote: r.is_internal_note as boolean,
    createdAt: r.created_at as string,
  };
}

function mapConversation(r: Record<string, unknown>): Conversation {
  return {
    id: r.id as string,
    customerPhone: r.customer_phone as string,
    customerName: r.customer_name as string | null,
    contactId: (r.contact_id as string) || undefined,
    status: r.status as 'active' | 'resolved',
    aiEnabled: r.ai_enabled as boolean,
    labels: r.labels as string[],
    unreadCount: r.unread_count as number,
    channel: r.channel as 'whatsapp' | 'instagram',
    lastMessage: r.last_message as string | null,
    ownerId: r.owner_id as string,
    assignedTo: r.assigned_to as string | null,
    assignedToName: r.assigned_to_name as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export const conversationsApi = {
  getAll: async (params?: {
    search?: string;
    channel?: ConversationChannel;
    status?: ConversationStatus;
  }): Promise<Conversation[]> => {
    const supabase = createClient();
    let q = supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (params?.channel && params.channel !== 'all') q = q.eq('channel', params.channel);
    if (params?.status && params.status !== 'all')   q = q.eq('status', params.status);
    if (params?.search) q = q.ilike('customer_name', `%${params.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => mapConversation(r as Record<string, unknown>));
  },
  getById: async (id: string): Promise<ConversationWithMessages> => {
    const supabase = createClient();
    const [convRes, msgsRes] = await Promise.all([
      supabase.from('conversations').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('conversation_id', id).order('created_at'),
    ]);
    if (convRes.error) throw convRes.error;
    const conversation = mapConversation(convRes.data as Record<string, unknown>);
    const messages = (msgsRes.data ?? []).map((r) => mapMessage(r as Record<string, unknown>));
    return { ...conversation, messages };
  },
  sendMessage: async (conversationId: string, content: string): Promise<ConversationMessage> => {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content, type: 'text' }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    const { id } = await res.json() as { id: string };
    const supabase = createClient();
    const { data, error } = await supabase.from('messages').select('*').eq('id', id).single();
    if (error) throw error;
    return mapMessage(data as Record<string, unknown>);
  },
  addNote: async (conversationId: string, content: string): Promise<ConversationMessage> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content, message_type: 'note', is_internal_note: true })
      .select()
      .single();
    if (error) throw error;
    return mapMessage(data as Record<string, unknown>);
  },
  toggleAI: async (conversationId: string, aiEnabled: boolean): Promise<{ aiEnabled: boolean }> => {
    const supabase = createClient();
    const { error } = await supabase.from('conversations').update({ ai_enabled: aiEnabled }).eq('id', conversationId);
    if (error) throw error;
    return { aiEnabled };
  },
  updateLabels: async (conversationId: string, labels: string[]): Promise<{ labels: string[] }> => {
    const supabase = createClient();
    const { error } = await supabase.from('conversations').update({ labels }).eq('id', conversationId);
    if (error) throw error;
    return { labels };
  },
  markRead: async (conversationId: string): Promise<{ success: boolean }> => {
    const supabase = createClient();
    const { error } = await supabase.from('conversations').update({ unread_count: 0 }).eq('id', conversationId);
    if (error) throw error;
    return { success: true };
  },
  assign: async (
    conversationId: string,
    assignedTo: string | null,
    assignedToName: string | null
  ): Promise<{ assignedTo: string | null; assignedToName: string | null }> => {
    const supabase = createClient();
    const { error } = await supabase
      .from('conversations')
      .update({ assigned_to: assignedTo, assigned_to_name: assignedToName })
      .eq('id', conversationId);
    if (error) throw error;
    return { assignedTo, assignedToName };
  },
};

// ---------- Active Agents (lightweight, any auth user) ----------

export interface AgentInfo {
  id: string;
  displayName: string | null;
  email: string;
}

export const agentsApi = {
  getAll: async (): Promise<AgentInfo[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('is_active', true);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      displayName: r.display_name ?? null,
      email: r.email,
    }));
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

export const teamApi = {
  getAll: async (): Promise<TeamMember[]> => {
    const supabase = createClient();
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name ?? null,
      role: r.role as 'admin' | 'agent',
      permissions: r.permissions ?? { conversations: true, crm: true, automations: false, quickResponses: true, settings: false },
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
    }));
  },
  invite: async (input: InviteTeamMemberInput): Promise<TeamMember & { inviteLink: string }> => {
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json() as { ok?: boolean; inviteLink?: string; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to invite member');
    // Return a partial TeamMember — the full row is fetched on next team query
    return {
      id: '',
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      permissions: {
        conversations: true,
        crm: false,
        automations: false,
        quickResponses: true,
        settings: false,
        ...input.permissions,
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      inviteLink: json.inviteLink!,
    };
  },
  update: async (input: UpdateTeamMemberInput): Promise<TeamMember> => {
    const supabase = createClient();
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...(rest.role ? { role: rest.role } : {}), ...(rest.isActive !== undefined ? { is_active: rest.isActive } : {}), ...(rest.permissions ? { permissions: rest.permissions } : {}) })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, email: data.email, displayName: data.display_name ?? null, role: data.role as 'admin' | 'agent', permissions: data.permissions ?? { conversations: true, crm: true, automations: false, quickResponses: true, settings: false }, isActive: data.is_active ?? true, createdAt: data.created_at };
  },
  remove: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', id);
    if (error) throw error;
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

export const automationsApi = {
  getAll: async (): Promise<Automation[]> => {
    const supabase = createClient();
    const { data, error } = await supabase.from('automations').select('*').order('created_at');
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id, name: r.name, description: r.description ?? null,
      trigger: r.trigger as AutomationTrigger,
      actions: r.actions as AutomationAction[],
      isActive: r.is_active,
      ownerId: r.owner_id, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  },
  create: async (input: CreateAutomationInput): Promise<Automation> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('automations')
      .insert({ name: input.name, description: input.description ?? null, trigger: input.trigger, actions: input.actions, is_active: input.isActive, owner_id: user!.id })
      .select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, description: data.description ?? null, trigger: data.trigger as AutomationTrigger, actions: data.actions as AutomationAction[], isActive: data.is_active, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  update: async (input: UpdateAutomationInput): Promise<Automation> => {
    const supabase = createClient();
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from('automations')
      .update({ ...rest, ...(rest.isActive !== undefined ? { is_active: rest.isActive } : {}), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, description: data.description ?? null, trigger: data.trigger as AutomationTrigger, actions: data.actions as AutomationAction[], isActive: data.is_active, ownerId: data.owner_id, createdAt: data.created_at, updatedAt: data.updated_at };
  },
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('automations').delete().eq('id', id);
    if (error) throw error;
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

function mapContact(r: Record<string, unknown>): Contact {
  const name = (r.name as string) ?? '';
  return {
    id: r.id as string,
    firstName: (r.first_name as string) ?? name,
    lastName: (r.last_name as string) ?? null,
    fullName: (r.full_name as string) ?? name,
    cedulaRuc: (r.cedula_ruc as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    phoneNormalized: (r.phone_normalized as string) ?? null,
    address: (r.address as string) ?? null,
    city: (r.city as string) ?? null,
    company: (r.company as string) ?? null,
    tags: (r.tags as string[]) ?? [],
    source: (r.source as string) ?? 'manual',
    ownerId: r.owner_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export const clientsApi = {
  getAll: async (search?: string): Promise<Contact[]> => {
    const supabase = createClient();
    let q = supabase.from('contacts').select('*').order('name').limit(200);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => mapContact(r as Record<string, unknown>));
  },
  getByPhone: async (phone: string): Promise<Contact | null> => {
    const supabase = createClient();
    const normalized = phone.replace(/\D/g, '');
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_normalized', normalized)
      .maybeSingle();
    return data ? mapContact(data as Record<string, unknown>) : null;
  },
  create: async (input: CreateContactInput): Promise<Contact> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ');
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        name: fullName,
        first_name: input.firstName,
        last_name: input.lastName ?? null,
        full_name: fullName,
        cedula_ruc: input.cedulaRuc ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        phone_normalized: input.phone?.replace(/\D/g, '') ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        company: input.company ?? null,
        tags: input.tags ?? [],
        source: 'manual',
        owner_id: user!.id,
      })
      .select().single();
    if (error) throw error;
    return mapContact(data as Record<string, unknown>);
  },
  update: async (input: UpdateContactInput): Promise<Contact> => {
    const supabase = createClient();
    const { id, ...rest } = input;
    const updates: Record<string, unknown> = {
      ...(rest.firstName !== undefined ? { first_name: rest.firstName, name: [rest.firstName, rest.lastName].filter(Boolean).join(' ') } : {}),
      ...(rest.lastName !== undefined ? { last_name: rest.lastName } : {}),
      ...(rest.cedulaRuc !== undefined ? { cedula_ruc: rest.cedulaRuc } : {}),
      ...(rest.email !== undefined ? { email: rest.email } : {}),
      ...(rest.phone !== undefined ? { phone: rest.phone, phone_normalized: rest.phone?.replace(/\D/g, '') ?? null } : {}),
      ...(rest.address !== undefined ? { address: rest.address } : {}),
      ...(rest.city !== undefined ? { city: rest.city } : {}),
      ...(rest.company !== undefined ? { company: rest.company } : {}),
      ...(rest.tags !== undefined ? { tags: rest.tags } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('contacts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return mapContact(data as Record<string, unknown>);
  },
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
  },
  deduplicate: async (): Promise<{ merged: number; deleted: number }> => {
    return { merged: 0, deleted: 0 };
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

function mapCatalog(r: Record<string, unknown>): Catalog {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    fileUrl: r.file_url as string,
    fileName: r.file_name as string,
    ownerId: r.owner_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export const catalogsApi = {
  getAll: async (): Promise<Catalog[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('catalogs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapCatalog(r as Record<string, unknown>));
  },
  create: async (input: CreateCatalogInput): Promise<Catalog> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('catalogs')
      .insert({
        name: input.name,
        description: input.description ?? null,
        file_url: input.fileUrl,
        file_name: input.fileName,
        owner_id: user!.id,
      })
      .select()
      .single();
    if (error) throw error;
    return mapCatalog(data as Record<string, unknown>);
  },
  update: async (id: string, updates: { name?: string; description?: string | null }): Promise<Catalog> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('catalogs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapCatalog(data as Record<string, unknown>);
  },
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('catalogs').delete().eq('id', id);
    if (error) throw error;
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

export const mediaApi = {
  send: async (conversationId: string, input: SendMediaInput): Promise<{ id: string; sent: boolean }> => {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        content: input.caption ?? '',
        type: input.mediaType,
        mediaUrl: input.mediaUrl,
        filename: input.filename,
      }),
    });
    if (!res.ok) throw new Error('Failed to send media');
    const { id } = await res.json() as { id: string };
    return { id, sent: true };
  },
};

// ---------- Meta / WhatsApp ----------

export type MetaStatus = 'active' | 'offline' | 'not_configured';

export interface MetaStatusResult {
  status: MetaStatus;
  phone?: string;
  name?: string;
}

export const metaApi = {
  getStatus: async (): Promise<MetaStatusResult> => {
    const res = await fetch('/api/whatsapp/status');
    if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
    return res.json() as Promise<MetaStatusResult>;
  },
};
