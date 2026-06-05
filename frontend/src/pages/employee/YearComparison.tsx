import { useMemo, useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuthStore } from '@/store/authStore';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export function EmployeeYearComparison() {
  const { user } = useAuthStore();
  const { data: documents, isLoading, error } = useDocuments(user?.id);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    const handleStorageChange = () => setIsDarkMode(localStorage.getItem('darkMode') === 'true');
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const form16Docs = useMemo(
    () => (documents?.filter((d) => d.document_type === 'form16_partA' || d.document_type === 'form16_partB') ?? [])
           .sort((a, b) => a.financial_year.localeCompare(b.financial_year)),
    [documents]
  );

  // Fetch metadata for each form16 document in parallel
  const metadataQueries = useQueries({
    queries: form16Docs.map((doc) => ({
      queryKey: ['document-metadata', doc._id],
      queryFn: async () => {
        try {
          const { data } = await api.get(`/documents/${doc._id}/metadata`);
          return data;
        } catch {
          return null;
        }
      },
      enabled: form16Docs.length > 0,
    })),
  });

  // Group by year and combine Part A + Part B data
  const yearDataMap = useMemo(() => {
    const map = new Map<string, { grossSalary: number | null; netSalary: number | null; taxPaid: number | null; tds: number | null }>();
    
    form16Docs.forEach((doc, i) => {
      const meta = metadataQueries[i]?.data;
      const parsed = meta?.parsed_json ?? {};
      const year = doc.financial_year;
      
      if (!map.has(year)) {
        map.set(year, { grossSalary: null, netSalary: null, taxPaid: null, tds: null });
      }
      
      const yearEntry = map.get(year)!;
      // Take the non-null value, prefer Part A data
      if (parsed.gross_salary !== null && parsed.gross_salary !== undefined) {
        yearEntry.grossSalary = yearEntry.grossSalary ?? parsed.gross_salary;
      }
      if (parsed.net_salary !== null && parsed.net_salary !== undefined) {
        yearEntry.netSalary = yearEntry.netSalary ?? parsed.net_salary;
      }
      if (parsed.tax_paid !== null && parsed.tax_paid !== undefined) {
        yearEntry.taxPaid = yearEntry.taxPaid ?? parsed.tax_paid;
      }
      if (parsed.tds !== null && parsed.tds !== undefined) {
        yearEntry.tds = yearEntry.tds ?? parsed.tds;
      }
    });
    
    return map;
  }, [form16Docs, metadataQueries]);

  // Convert to sorted array
  const yearData = useMemo(() => {
    return Array.from(yearDataMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, data]) => ({
        year,
        ...data,
      }));
  }, [yearDataMap]);

  const chartData = useMemo(() => {
    const labels = yearData.map((d) => d.year);
    return {
      labels,
      datasets: [
        {
          label: 'Gross Salary',
          data: yearData.map((d) => d.grossSalary),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          spanGaps: true,
          tension: 0.4,
        },
        {
          label: 'Net Salary',
          data: yearData.map((d) => d.netSalary),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          spanGaps: true,
          tension: 0.4,
        },
        {
          label: 'Tax Paid',
          data: yearData.map((d) => d.taxPaid),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          spanGaps: true,
          tension: 0.4,
        },
      ],
    };
  }, [yearData]);

  const options: any = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { 
        position: 'top' as const,
        labels: {
          color: isDarkMode ? '#d1d5db' : '#1f2937',
          font: { size: 12, weight: 'bold' },
        }
      },
      title: { 
        display: true, 
        text: 'Your Salary Trends Over Years',
        font: { size: 16, weight: 'bold' },
        color: isDarkMode ? '#f3f4f6' : '#1f2937',
      },
    },
    scales: {
      y: {
        ticks: {
          color: isDarkMode ? '#d1d5db' : '#6b7280',
          callback: (value: unknown) => '₹' + Number(value).toLocaleString(),
        },
        grid: {
          color: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        }
      },
      x: {
        ticks: {
          color: isDarkMode ? '#d1d5db' : '#6b7280',
        },
        grid: {
          color: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        }
      }
    },
  };

  // Compute growth between consecutive years
  function growth(curr: number | null, prev: number | null) {
    if (curr == null || prev == null || prev === 0) return null;
    return (((curr - prev) / prev) * 100).toFixed(1);
  }

  const totalGross = yearData.reduce((s, d) => s + (d.grossSalary ?? 0), 0);
  const totalTax = yearData.reduce((s, d) => s + (d.taxPaid ?? 0), 0);

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load comparison data" /></Layout>;

  if (form16Docs.length < 2) {
    return (
      <Layout>
        <div className="space-y-6 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white">📈 Year Comparison</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Compare your salary across years</p>
          </div>
          <div className={`rounded-3xl overflow-hidden p-12 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <EmptyState
              icon="�"
              title="Need more data"
              description="You need at least 2 years of Form-16 documents to view salary comparisons."
            />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className={`rounded-3xl overflow-hidden p-8 md:p-12 ${isDarkMode ? 'bg-gradient-to-br from-indigo-900 to-purple-900' : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'}`}>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            📈 Year Comparison
          </h1>
          <p className="text-xl text-purple-100 max-w-2xl">
            Visualize your salary trends and financial growth over the years
          </p>
        </div>

        {/* Chart */}
        <div className={`rounded-3xl overflow-hidden p-6 md:p-8 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📊 Salary Trend Chart
          </h2>
          <div className="relative h-96 md:h-[500px]">
            <Line options={options} data={chartData} />
          </div>
        </div>

        {/* Year-over-Year Table */}
        <div className={`rounded-3xl overflow-hidden ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`px-6 md:px-8 py-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50'}`}>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              📋 Year-over-Year Comparison
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className={`w-full`}>
              <thead>
                <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  <th className={`px-6 py-4 text-left font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Financial Year
                  </th>
                  <th className={`px-6 py-4 text-left font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Gross Salary
                  </th>
                  <th className={`px-6 py-4 text-left font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Net Salary
                  </th>
                  <th className={`px-6 py-4 text-left font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Tax Paid
                  </th>
                  <th className={`px-6 py-4 text-left font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody>
                {yearData.map((row, index) => {
                  const prev = index > 0 ? yearData[index - 1].grossSalary : null;
                  const g = growth(row.grossSalary, prev);
                  return (
                    <tr key={row.year} className={`border-b transition-colors ${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <td className={`px-6 py-4 font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        📅 {row.year}
                      </td>
                      <td className={`px-6 py-4 font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                        {row.grossSalary != null ? `₹${row.grossSalary.toLocaleString()}` : '—'}
                      </td>
                      <td className={`px-6 py-4 font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                        {row.netSalary != null ? `₹${row.netSalary.toLocaleString()}` : '—'}
                      </td>
                      <td className={`px-6 py-4 font-semibold ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                        {row.taxPaid != null ? `₹${row.taxPaid.toLocaleString()}` : '—'}
                      </td>
                      <td className={`px-6 py-4`}>
                        {g !== null ? (
                          <span className={`inline-block px-3 py-1 rounded-full font-bold ${Number(g) >= 0 ? (isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-900') : (isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-900')}`}>
                            {Number(g) >= 0 ? '📈 +' : '📉 '}{g}%
                          </span>
                        ) : (
                          <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`rounded-2xl p-8 ${isDarkMode ? 'bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-700' : 'bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-400'}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">💰</span>
              <h3 className="font-bold text-white text-lg">Total Earned</h3>
            </div>
            <p className="text-3xl font-black text-white">
              {totalGross > 0 ? `₹${(totalGross / 100000).toFixed(1)}L` : '—'}
            </p>
            <p className="text-sm text-blue-100 mt-2">Gross across all years</p>
          </div>

          <div className={`rounded-2xl p-8 ${isDarkMode ? 'bg-gradient-to-br from-red-900 to-red-800 border border-red-700' : 'bg-gradient-to-br from-red-500 to-red-600 border border-red-400'}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🏦</span>
              <h3 className="font-bold text-white text-lg">Total Tax</h3>
            </div>
            <p className="text-3xl font-black text-white">
              {totalTax > 0 ? `₹${(totalTax / 100000).toFixed(1)}L` : '—'}
            </p>
            <p className="text-sm text-red-100 mt-2">Across all years</p>
          </div>

          <div className={`rounded-2xl p-8 ${isDarkMode ? 'bg-gradient-to-br from-green-900 to-green-800 border border-green-700' : 'bg-gradient-to-br from-green-500 to-green-600 border border-green-400'}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">📄</span>
              <h3 className="font-bold text-white text-lg">Years on Record</h3>
            </div>
            <p className="text-3xl font-black text-white">{form16Docs.length}</p>
            <p className="text-sm text-green-100 mt-2">Form-16 documents</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
