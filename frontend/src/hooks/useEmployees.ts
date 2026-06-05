import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Employee } from '@/types';

export function useEmployees() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get('/employees');
      return data as Employee[];
    },
    enabled: isAuthenticated,
  });
}

export function useEmployee(id: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data } = await api.get(`/employees/${id}`);
      return data;
    },
    enabled: !!id && isAuthenticated,
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Employee> }) => {
      const { data } = await api.put(`/employees/${id}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
