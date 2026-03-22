import { useListConversations, useGetConversation } from "@workspace/api-client-react";

export function useConversations() {
  return useListConversations();
}

export function useConversationDetails(id: number) {
  return useGetConversation(id, { query: { enabled: !!id } });
}
