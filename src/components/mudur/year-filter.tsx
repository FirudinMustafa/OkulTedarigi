"use client"

import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

export default function YearFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('mudur.yearFilter')
  const currentYear = searchParams.get('year') || 'all'

  const years: string[] = []
  const now = new Date().getFullYear()
  for (let y = now; y >= now - 5; y--) {
    years.push(y.toString())
  }

  const handleChange = (value: string) => {
    if (value === 'all') {
      router.push('/mudur/raporlar')
    } else {
      router.push(`/mudur/raporlar?year=${value}`)
    }
  }

  return (
    <Select value={currentYear} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={t('placeholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('allYears')}</SelectItem>
        {years.map(y => (
          <SelectItem key={y} value={y}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
