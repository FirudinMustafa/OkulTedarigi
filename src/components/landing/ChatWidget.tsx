'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { X, PaperPlaneRight, Robot } from '@phosphor-icons/react'

type Msg = { role: 'user' | 'assistant'; content: string }

// Yanıt içindeki /siparis, /siparis-takip gibi iç linkleri ve WhatsApp (wa.me) linkini
// tıklanabilir yapar.
function renderContent(text: string, whatsappLabel: string) {
  const parts = text.split(/(\/(?:siparis-takip|siparis|kvkk|mesafeli-satis)\b|#sss|https?:\/\/wa\.me\/\d+)/g)
  return parts.map((part, i) => {
    if (/^https?:\/\/wa\.me\/\d+$/.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#10b981] underline underline-offset-2 hover:opacity-80"
        >
          {whatsappLabel}
        </a>
      )
    }
    if (/^\/(siparis-takip|siparis|kvkk|mesafeli-satis)$/.test(part) || part === '#sss') {
      const href = part === '#sss' ? '/#sss' : part
      return (
        <a
          key={i}
          href={href}
          className="text-apple-blue underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function ChatWidget() {
  const t = useTranslations('landing.chat')
  const locale = useLocale()
  const WELCOME = useMemo<Msg>(
    () => ({ role: 'assistant', content: t('welcome') }),
    [t]
  )
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [nudge, setNudge] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, open])

  // "Bir yardıma ihtiyacınız var mı?" bildirim balonu — sayfa açıldıktan ~4 sn sonra,
  // sohbet açılmamışsa ve kapatılmamışsa bir kez gösterilir.
  useEffect(() => {
    if (open) { setNudge(false); return }
    if (nudgeDismissed) return
    const t = setTimeout(() => setNudge(true), 4000)
    return () => clearTimeout(t)
  }, [open, nudgeDismissed])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/veli/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Welcome mesajini gondermeye gerek yok (statik karsilama).
        body: JSON.stringify({ messages: next.filter((m) => m !== WELCOME), locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: data?.error || t('errorBusy'),
          },
        ])
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
      }
    } catch (error) {
      console.error('Chatbot istek hatasi:', error)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: t('errorConnection'),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* "Bir yardıma ihtiyacınız var mı?" bildirim balonu */}
      {nudge && !open && (
        <div className="fixed bottom-[5.5rem] right-5 z-[60] max-w-[15rem] animate-in fade-in slide-in-from-bottom-2">
          <div className="relative bg-white border border-apple-border/60 rounded-2xl rounded-br-sm shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] px-4 py-3 pr-7">
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => { setNudge(false); setNudgeDismissed(true) }}
              className="absolute top-1.5 right-1.5 text-apple-gray hover:text-apple-ink"
            >
              <X weight="bold" className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setOpen(true); setNudge(false) }}
              className="flex items-start gap-2 text-left"
            >
              <Robot weight="fill" className="w-5 h-5 text-[#2563eb] shrink-0 mt-0.5" />
              <span className="text-[13px] text-apple-ink leading-snug">
                {t('nudge')}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Yüzen buton (chatbot ikonu) */}
      <button
        type="button"
        aria-label={open ? t('closeChat') : t('openChat')}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[60] flex items-center justify-center w-14 h-14 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_8px_30px_-6px_rgba(37,99,235,0.5)] transition-all hover:scale-105 active:scale-95"
      >
        {open ? (
          <X weight="bold" className="w-6 h-6" />
        ) : (
          <Robot weight="fill" className="w-7 h-7" />
        )}
        {/* Yeni asistan oldugunu vurgulayan kucuk nokta */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-5 z-[60] w-[calc(100vw-2.5rem)] max-w-sm origin-bottom-right transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-[28rem] max-h-[70vh] bg-white border border-apple-border/60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] overflow-hidden">
          {/* Başlık */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-apple-border/60 bg-apple-panel">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#2563eb] text-white">
              <Robot weight="fill" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-apple-ink leading-tight">
                {t('headerTitle')}
              </p>
              <p className="text-[12px] text-apple-gray leading-tight">
                {t('headerSubtitle')}
              </p>
            </div>
          </div>

          {/* Mesajlar */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-apple-blue text-white rounded-br-md'
                      : 'bg-apple-panel text-apple-ink rounded-bl-md'
                  }`}
                >
                  {m.role === 'assistant' ? renderContent(m.content, t('whatsappLinkLabel')) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-apple-panel text-apple-gray px-3.5 py-2.5 rounded-2xl rounded-bl-md text-[13.5px]">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-apple-gray rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-apple-gray rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-apple-gray rounded-full animate-bounce" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Giriş */}
          <div className="border-t border-apple-border/60 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                rows={1}
                placeholder={t('placeholder')}
                className="flex-1 resize-none max-h-24 px-3.5 py-2.5 rounded-2xl bg-apple-panel text-[13.5px] text-apple-ink placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label={t('send')}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <PaperPlaneRight weight="fill" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
