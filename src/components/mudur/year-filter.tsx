"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

export default function YearFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
        <SelectValue placeholder="Yil secin" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tum Yillar</SelectItem>
        {years.map(y => (
          <SelectItem key={y} value={y}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
