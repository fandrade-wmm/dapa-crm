import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface BotConfig {
  id: number | null;
  customInstructions: string | null;
  updatedAt: string | null;
}

export interface BotQaPair {
  id: number;
  question: string;
  answer: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TrainingData {
  config: BotConfig;
  qaPairs: BotQaPair[];
}

async function fetchTraining(): Promise<TrainingData> {
  const res = await fetch(`${BASE}/api/bot/training`);
  if (!res.ok) throw new Error("Failed to fetch training data");
  return res.json();
}

async function saveConfig(customInstructions: string): Promise<void> {
  const res = await fetch(`${BASE}/api/bot/training/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customInstructions }),
  });
  if (!res.ok) throw new Error("Failed to save config");
}

async function createQaPair(data: { question: string; answer: string }): Promise<BotQaPair> {
  const res = await fetch(`${BASE}/api/bot/training/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create Q&A pair");
  const json = await res.json();
  return json.qaPair;
}

async function updateQaPair(id: number, data: Partial<BotQaPair>): Promise<BotQaPair> {
  const res = await fetch(`${BASE}/api/bot/training/qa/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update Q&A pair");
  const json = await res.json();
  return json.qaPair;
}

async function deleteQaPair(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/bot/training/qa/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete Q&A pair");
}

export function useBotTraining() {
  return useQuery({ queryKey: ["bot-training"], queryFn: fetchTraining });
}

export function useSaveBotConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-training"] }),
  });
}

export function useCreateQaPair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQaPair,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-training"] }),
  });
}

export function useUpdateQaPair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BotQaPair> }) => updateQaPair(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-training"] }),
  });
}

export function useDeleteQaPair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteQaPair,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-training"] }),
  });
}
