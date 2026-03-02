import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, ClipboardList, X } from 'lucide-react'
import { searchApi, SearchResult } from '@/api/search'

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const timerRef = useRef<number>(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchApi.search(query.trim())
        setResults(data)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  if (!open) return null

  const hasResults = results && (results.patients.length > 0 || results.orders.length > 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pacientes, órdenes..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <kbd className="hidden sm:inline-block text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">Buscando...</div>
          )}

          {!loading && query && !hasResults && (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              No se encontraron resultados
            </div>
          )}

          {!loading && hasResults && (
            <>
              {results!.patients.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    Pacientes
                  </p>
                  {results!.patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => go(`/patients/${p.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors"
                    >
                      <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{p.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          MRN: {p.mrn}{p.dni ? ` · DNI: ${p.dni}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results!.orders.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    Órdenes
                  </p>
                  {results!.orders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => go(`/patients/${o.patient_id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors"
                    >
                      <ClipboardList className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                          {o.procedure_description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {o.accession_number} · {o.modality} · {o.status}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {!query && (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              Escriba para buscar pacientes por nombre, MRN o DNI, u órdenes por accession number
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
