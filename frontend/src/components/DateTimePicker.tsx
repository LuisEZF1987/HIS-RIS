import { useMemo } from 'react'

interface Props {
  value?: string        // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void
  className?: string
}

const selectClass =
  'px-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none'

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

export function DateTimePicker({ value, onChange, className }: Props) {
  const [datePart, hourPart, minPart] = useMemo(() => {
    if (!value) return ['', '08', '00']
    const [d, t = ''] = value.split('T')
    const [h = '08', m = '00'] = t.slice(0, 5).split(':')
    return [d, h, m]
  }, [value])

  const emit = (d: string, h: string, m: string) => {
    if (d) onChange(`${d}T${h}:${m}`)
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ''}`}>
      {/* Date */}
      <input
        type="date"
        value={datePart}
        onChange={(e) => emit(e.target.value, hourPart, minPart)}
        className={`${selectClass} flex-1 min-w-[140px]`}
      />

      <span className="text-gray-400 dark:text-slate-500 text-sm select-none">a las</span>

      {/* Hour */}
      <select
        value={hourPart}
        onChange={(e) => emit(datePart, e.target.value, minPart)}
        className={`${selectClass} w-[70px]`}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}h</option>
        ))}
      </select>

      <span className="text-gray-500 dark:text-slate-400 font-bold select-none">:</span>

      {/* Minute */}
      <select
        value={minPart}
        onChange={(e) => emit(datePart, hourPart, e.target.value)}
        className={`${selectClass} w-[70px]`}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m} min</option>
        ))}
      </select>
    </div>
  )
}
