import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { ImportJob, ImportJobLog, DocumentType } from '@/types';

export function useImportJobs() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['import-jobs'],
    queryFn: async () => {
      const { data } = await api.get('/import/jobs');
      return data as ImportJob[];
    },
    enabled: isAuthenticated,
  });
}

export function useImportJob(id: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['import-job', id],
    queryFn: async () => {
      const { data } = await api.get(`/import/jobs/${id}`);
      return data as ImportJob;
    },
    enabled: !!id && isAuthenticated,
  });
}

export function useImportJobLogs(jobId: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['import-job-logs', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/import/jobs/${jobId}/logs`);
      return data as ImportJobLog[];
    },
    enabled: !!jobId && isAuthenticated,
  });
}

export function useCreateImportJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      documentType,
    }: {
      file: File;
      documentType: DocumentType;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const { data } = await api.post('/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });
}
