import { useGetBotStatus, useTestBot, useVerifyWhatsappWebhook } from "@workspace/api-client-react";

export function useBotStatus() {
  return useGetBotStatus();
}

export function useBotTest() {
  return useTestBot();
}

export function useWebhookVerification(params?: { "hub.mode"?: string; "hub.verify_token"?: string; "hub.challenge"?: string; }) {
  return useVerifyWhatsappWebhook(params, { query: { enabled: !!params?.["hub.challenge"] } });
}
