'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('appError.error')

  useEffect(() => {
    console.error('Uygulama hatasi:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">&#9888;</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('title')}
        </h1>
        <p className="text-gray-600 mb-8">
          {t('message')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {t('retry')}
          </button>
          <a
            href="/"
            className="px-6 py-3 bg-white text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            {t('home')}
          </a>
        </div>
      </div>
    </div>
  )
}
