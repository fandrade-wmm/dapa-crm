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
