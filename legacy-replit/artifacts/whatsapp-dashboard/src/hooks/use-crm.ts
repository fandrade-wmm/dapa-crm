import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CrmLead, CrmStage } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchLeads(): Promise<CrmLead[]> {
  const res = await fetch(`${BASE}/api/crm/leads`);
  if (!res.ok) throw new Error("Failed to fetch leads");
  const data = await res.json();
  return data.leads;
}

async function createLead(body: Partial<CrmLead>): Promise<CrmLead> {
  const res = await fetch(`${BASE}/api/crm/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create lead");
  const data = await res.json();
  return data.lead;
}

async function updateLead(id: number, body: Partial<CrmLead>): Promise<CrmLead> {
  const res = await fetch(`${BASE}/api/crm/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update lead");
  const data = await res.json();
  return data.lead;
}

async function deleteLead(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/crm/leads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete lead");
}

export function useCrmLeads() {
  return useQuery({ queryKey: ["crm-leads"], queryFn: fetchLeads });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CrmLead> }) => updateLead(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });
}

export type { CrmLead, CrmStage };
