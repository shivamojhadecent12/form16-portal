import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChatMessage } from '@/types';

export function useChatHistory(employeeId: string, documentId?: string) {
  return useQuery({
    queryKey: ['chat-history', employeeId, documentId],
    queryFn: async () => {
      const { data } = await api.get('/chat', {
        params: { documentId },
      });
      return data as ChatMessage[];
    },
    enabled: !!employeeId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      question,
    }: {
      employeeId: string;
      documentId: string;
      question: string;
    }) => {
      const { data } = await api.post('/chat', { documentId, question });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['chat-history', variables.employeeId, variables.documentId],
      });
    },
  });
}

export function useClearChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      await api.delete('/chat', {
        params: { documentId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chat-history'],
      });
    },
  });
}
