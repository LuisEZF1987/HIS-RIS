import { useQuery } from '@tanstack/react-query'
import { templatesApi, ReportTemplate } from '@/api/templates'
import { FileStack } from 'lucide-react'

interface Props {
  modality?: string
  onSelect: (template: ReportTemplate) => void
}

export default function TemplateSelector({ modality, onSelect }: Props) {
  const { data: templates } = useQuery({
    queryKey: ['templates', modality],
    queryFn: () => templatesApi.list({ modality: modality || undefined, active_only: true }),
  })

  if (!templates?.length) return null

  return (
    <div className="flex items-center gap-2">
      <FileStack className="w-4 h-4 text-gray-400 dark:text-slate-500" />
      <select
        onChange={(e) => {
          const tpl = templates.find((t) => t.id === Number(e.target.value))
          if (tpl) onSelect(tpl)
          e.target.value = ''
        }}
        defaultValue=""
        className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 outline-none"
      >
        <option value="" disabled>Aplicar plantilla...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.modality ? ` (${t.modality})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
