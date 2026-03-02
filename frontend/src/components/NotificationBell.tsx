import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { notificationsApi, type Notification } from '@/api/notifications'

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Poll unread count every 30s
  useEffect(() => {
    const fetch = () => {
      notificationsApi.unreadCount().then(setUnread).catch(() => {})
    }
    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      try {
        const data = await notificationsApi.list()
        setItems(data)
      } catch { /* ignore */ }
      setLoading(false)
    }
  }

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await notificationsApi.markRead(n.id).catch(() => {})
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i))
      setUnread(prev => Math.max(0, prev - 1))
    }
    if (n.link) {
      navigate(n.link)
      setOpen(false)
    }
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setItems(prev => prev.map(i => ({ ...i, is_read: true })))
    setUnread(0)
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todo leído
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-400">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">Sin notificaciones</div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={clsx(
                    'w-full text-left px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors',
                    !n.is_read && 'bg-blue-50/50 dark:bg-blue-900/10',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'text-sm truncate',
                        n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium',
                      )}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {n.body}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
