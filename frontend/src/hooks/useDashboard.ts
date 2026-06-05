import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { DashboardStats } from '@/types';

export function useDashboardStats() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats');
      return data as DashboardStats;
    },
    enabled: isAuthenticated,
  });
}
