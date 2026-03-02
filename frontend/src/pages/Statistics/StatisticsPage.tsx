import { useQuery } from '@tanstack/react-query'
import { statisticsApi } from '@/api/statistics'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6']

const cardClass = 'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6'

export default function StatisticsPage() {
  const { data: modalityData } = useQuery({
    queryKey: ['stats', 'modality'],
    queryFn: () => statisticsApi.ordersByModality(6),
  })

  const { data: turnaroundData } = useQuery({
    queryKey: ['stats', 'turnaround'],
    queryFn: () => statisticsApi.turnaroundTime(6),
  })

  const { data: productivityData } = useQuery({
    queryKey: ['stats', 'productivity'],
    queryFn: () => statisticsApi.radiologistProductivity(6),
  })

  // Pivot modality data for stacked bar chart
  const { modalityChartData, modalities } = useMemo(() => {
    if (!modalityData?.length) return { modalityChartData: [], modalities: [] }
    const monthMap = new Map<string, Record<string, number>>()
    const modalitySet = new Set<string>()
    for (const d of modalityData) {
      modalitySet.add(d.modality)
      if (!monthMap.has(d.month)) monthMap.set(d.month, {})
      monthMap.get(d.month)![d.modality] = d.count
    }
    const mods = Array.from(modalitySet)
    const chart = Array.from(monthMap.entries()).map(([month, counts]) => ({ month, ...counts }))
    return { modalityChartData: chart, modalities: mods }
  }, [modalityData])

  // Pivot productivity data
  const { productivityChartData, radiologists } = useMemo(() => {
    if (!productivityData?.length) return { productivityChartData: [], radiologists: [] }
    const monthMap = new Map<string, Record<string, number>>()
    const radSet = new Set<string>()
    for (const d of productivityData) {
      const name = d.radiologist || 'Desconocido'
      radSet.add(name)
      if (!monthMap.has(d.month)) monthMap.set(d.month, {})
      monthMap.get(d.month)![name] = d.count
    }
    const rads = Array.from(radSet)
    const chart = Array.from(monthMap.entries()).map(([month, counts]) => ({ month, ...counts }))
    return { productivityChartData: chart, radiologists: rads }
  }, [productivityData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Análisis de actividad de los últimos 6 meses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Modality - Stacked Bar Chart */}
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Órdenes por Modalidad</h2>
          {modalityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modalityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-slate-700" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
                <Legend />
                {modalities.map((mod, i) => (
                  <Bar key={mod} dataKey={mod} stackId="a" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Sin datos</div>
          )}
        </div>

        {/* Turnaround Time */}
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tiempo Promedio de Turno (horas)</h2>
          {turnaroundData?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={turnaroundData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-slate-700" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" />
                <YAxis type="category" dataKey="month" tick={{ fontSize: 12 }} width={70} stroke="currentColor" className="text-gray-400 dark:text-slate-500" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
                <Bar dataKey="avg_hours" name="Horas promedio" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Sin datos</div>
          )}
        </div>

        {/* Radiologist Productivity */}
        <div className={`${cardClass} lg:col-span-2`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Productividad de Radiólogos (Informes Firmados)</h2>
          {productivityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productivityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-slate-700" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
                <Legend />
                {radiologists.map((rad, i) => (
                  <Bar key={rad} dataKey={rad} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Sin datos</div>
          )}
        </div>
      </div>
    </div>
  )
}
