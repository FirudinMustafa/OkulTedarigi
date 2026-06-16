import { getTranslations } from 'next-intl/server'
import DashboardCharts from '@/components/admin/DashboardCharts'

export default async function AdminDashboard() {
  const t = await getTranslations('admin.dashboard')
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          {t('liveData')}
        </div>
      </div>

      <DashboardCharts />
    </div>
  )
}
