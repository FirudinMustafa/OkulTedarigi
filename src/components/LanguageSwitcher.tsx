'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const FLAGS: Record<AppLocale, string> = {
  tr: '🇹🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  ar: '🇸🇦',
}

export function LanguageSwitcher({
  className,
  align = 'end',
  placement = 'down',
  variant = 'dropdown',
}: {
  className?: string
  align?: 'start' | 'end'
  placement?: 'down' | 'up'
  variant?: 'dropdown' | 'inline'
}) {
  const t = useTranslations('languageSwitcher')
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function change(next: AppLocale) {
    setOpen(false)
    if (next === locale) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  // Inline varyant — mobil menü gibi overflow-hidden konteynerlerde dropdown
  // kırpıldığından, 4 dili satır içi buton olarak gösterir.
  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => change(l)}
            disabled={isPending}
            aria-pressed={l === locale}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition disabled:opacity-60',
              l === locale
                ? 'border-primary bg-primary/5 font-medium text-primary'
                : 'border-border text-foreground hover:bg-secondary'
            )}
          >
            <span className="text-base leading-none">{FLAGS[l]}</span>
            <span>{l.toUpperCase()}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-label={t('label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/80 px-2.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t(locale)}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-white py-1 shadow-lg',
            placement === 'up' ? 'bottom-full mb-1' : 'mt-1',
            align === 'end' ? 'end-0' : 'start-0'
          )}
        >
          {locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => change(l)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-secondary"
              >
                <span className="text-base leading-none">{FLAGS[l]}</span>
                <span className="flex-1">{t(l)}</span>
                {l === locale && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default LanguageSwitcher
