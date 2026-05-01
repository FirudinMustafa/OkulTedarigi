import DashboardCharts from '@/components/admin/DashboardCharts'

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Sistem genel gorunumu ve istatistikler</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Canli veri
        </div>
      </div>

      <DashboardCharts />
    </div>
  )
}
