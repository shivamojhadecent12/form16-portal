import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Document, DocumentMetadata, AIAnalysis } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

export function useDocuments(employeeId?: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['documents', employeeId],
    queryFn: async () => {
      const { data } = await api.get('/documents', {
        params: employeeId ? { employeeId } : {},
      });
      return data as Document[];
    },
    enabled: isAuthenticated,
  });
}

export function useDocument(id: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data } = await api.get(`/documents/${id}`);
      return data;
    },
    enabled: !!id && isAuthenticated,
  });
}

export function useDocumentMetadata(documentId: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['document-metadata', documentId],
    queryFn: async () => {
      const { data } = await api.get(`/documents/${documentId}/metadata`);
      return data as DocumentMetadata;
    },
    enabled: !!documentId && isAuthenticated,
  });
}

export function useDocumentAnalysis(documentId: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['document-analysis', documentId],
    queryFn: async () => {
      const { data } = await api.get(`/documents/${documentId}/analysis`);
      return data as AIAnalysis;
    },
    enabled: !!documentId && isAuthenticated,
  });
}

/** Returns URLs for previewing (inline) and downloading (attachment) a document. */
export function useDocumentUrls(documentId: string) {
  return useQuery({
    queryKey: ['document-urls', documentId],
    queryFn: () => {
      const token = localStorage.getItem('auth_token') ?? '';
      return {
        preview: `${BASE_URL}/documents/${documentId}/preview?token=${token}`,
        download: `${BASE_URL}/documents/${documentId}/download?token=${token}`,
      };
    },
    enabled: !!documentId,
  });
}

/** @deprecated use useDocumentUrls */
export function useDocumentUrl(documentId: string) {
  return useDocumentUrls(documentId);
}

export function useUpdateDocumentReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { data } = await api.put(`/documents/${id}/review`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/documents/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useReplaceDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.put(`/documents/${id}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['document-metadata', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['document-analysis', variables.id] });
    },
  });
}

export function usePendingReviews() {
  return useQuery({
    queryKey: ['pending-reviews'],
    queryFn: async () => {
      const { data } = await api.get('/documents/reviews/pending');
      return data as Document[];
    },
  });
}
