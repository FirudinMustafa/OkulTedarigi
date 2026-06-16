'use client'

import { Button } from "@/components/ui/button"
import { FileSpreadsheet } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

export default function ReportExportButton() {
  const searchParams = useSearchParams()
  const t = useTranslations('mudur.reportExport')
  const year = searchParams.get('year') || 'all'

  const handleExport = () => {
    window.location.href = `/api/mudur/reports/export?year=${year}`
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      {t('downloadExcel')}
    </Button>
  )
}
