"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Tag } from "lucide-react"

interface Discount {
  id: string
  code: string
  description: string | null
  description_en?: string | null
  description_de?: string | null
  description_ar?: string | null
  type: "PERCENTAGE" | "FIXED"
  value: number
  minAmount: number | null
  maxDiscount: number | null
  validFrom: string
  validUntil: string
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}

export default function IndirimlerPage() {
  const t = useTranslations('admin.discounts')
  const tf = useTranslations('admin.i18nFields')
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    description_en: "",
    description_de: "",
    description_ar: "",
    type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
    value: "",
    minAmount: "",
    maxDiscount: "",
    validFrom: "",
    validUntil: "",
    usageLimit: ""
  })

  useEffect(() => {
    loadDiscounts()
  }, [])

  const loadDiscounts = async () => {
    try {
      const res = await fetch("/api/admin/discounts", { credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        setDiscounts(data.discounts)
      }
    } catch (error) {
      console.error("Indirimler yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      description_en: "",
      description_de: "",
      description_ar: "",
      type: "PERCENTAGE",
      value: "",
      minAmount: "",
      maxDiscount: "",
      validFrom: "",
      validUntil: "",
      usageLimit: ""
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (d: Discount) => {
    setFormData({
      code: d.code,
      description: d.description || "",
      description_en: d.description_en || "",
      description_de: d.description_de || "",
      description_ar: d.description_ar || "",
      type: d.type,
      value: String(d.value),
      minAmount: d.minAmount ? String(d.minAmount) : "",
      maxDiscount: d.maxDiscount ? String(d.maxDiscount) : "",
      validFrom: new Date(d.validFrom).toISOString().slice(0, 16),
      validUntil: new Date(d.validUntil).toISOString().slice(0, 16),
      usageLimit: d.usageLimit ? String(d.usageLimit) : ""
    })
    setEditingId(d.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      code: formData.code,
      description: formData.description || null,
      description_en: formData.description_en || null,
      description_de: formData.description_de || null,
      description_ar: formData.description_ar || null,
      type: formData.type,
      value: Number(formData.value),
      minAmount: formData.minAmount ? Number(formData.minAmount) : null,
      maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
      validFrom: formData.validFrom,
      validUntil: formData.validUntil,
      usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null
    }

    try {
      const url = editingId
        ? `/api/admin/discounts/${editingId}`
        : "/api/admin/discounts"

      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        resetForm()
        loadDiscounts()
      } else {
        const data = await res.json()
        alert(data.error || t('errorOccurred'))
      }
    } catch {
      alert(t('genericError'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return

    try {
      const res = await fetch(`/api/admin/discounts/${id}`, { method: "DELETE", credentials: 'include' })
      if (res.ok) {
        loadDiscounts()
      }
    } catch {
      alert(t('deleteFailed'))
    }
  }

  const toggleActive = async (d: Discount) => {
    try {
      const res = await fetch(`/api/admin/discounts/${d.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: !d.isActive })
      })
      if (res.ok) {
        loadDiscounts()
      }
    } catch {
      alert(t('updateFailed'))
    }
  }

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const isExpired = (d: Discount) => new Date(d.validUntil) < new Date()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newDiscount')}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t('editDiscount') : t('newDiscountCode')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="code">{t('codeLabel')}</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="YILBASI20"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">{t('descriptionLabel')}</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('descriptionPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="type">{t('typeLabel')}</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "PERCENTAGE" | "FIXED" })}
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                  >
                    <option value="PERCENTAGE">{t('typePercentage')}</option>
                    <option value="FIXED">{t('typeFixed')}</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="value">
                    {t('valueLabel')} {formData.type === "PERCENTAGE" ? "(%)" : "(TL)"}
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.type === "PERCENTAGE" ? "100" : undefined}
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="minAmount">{t('minAmountLabel')}</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="maxDiscount">{t('maxDiscountLabel')}</Label>
                  <Input
                    id="maxDiscount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    placeholder={t('maxDiscountPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="validFrom">{t('validFromLabel')}</Label>
                  <Input
                    id="validFrom"
                    type="datetime-local"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="validUntil">{t('validUntilLabel')}</Label>
                  <Input
                    id="validUntil"
                    type="datetime-local"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="usageLimit">{t('usageLimitLabel')}</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    min="0"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    placeholder={t('usageLimitPlaceholder')}
                  />
                </div>
              </div>

              {/* Aciklama cevirileri (opsiyonel) */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium">
                  {tf('translations')}{' '}
                  <span className="text-gray-400 font-normal">{tf('optional')}</span>
                </p>
                <p className="text-xs text-gray-500 mb-3">{tf('translationsHint')}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="description_en">{t('descriptionLabel')} ({tf('en')})</Label>
                    <Input
                      id="description_en"
                      value={formData.description_en}
                      onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description_de">{t('descriptionLabel')} ({tf('de')})</Label>
                    <Input
                      id="description_de"
                      value={formData.description_de}
                      onChange={(e) => setFormData({ ...formData, description_de: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description_ar">{t('descriptionLabel')} ({tf('ar')})</Label>
                    <Input
                      id="description_ar"
                      dir="rtl"
                      value={formData.description_ar}
                      onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? t('update') : t('create')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {discounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>{t('emptyList')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {discounts.map((d) => (
            <Card key={d.id} className={!d.isActive || isExpired(d) ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Tag className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">{d.code}</span>
                        {d.isActive && !isExpired(d) ? (
                          <Badge className="bg-green-100 text-green-800">{t('statusActive')}</Badge>
                        ) : isExpired(d) ? (
                          <Badge variant="secondary">{t('statusExpired')}</Badge>
                        ) : (
                          <Badge variant="destructive">{t('statusInactive')}</Badge>
                        )}
                      </div>
                      {d.description && (
                        <p className="text-sm text-gray-500">{d.description}</p>
                      )}
                      <div className="flex gap-4 mt-1 text-xs text-gray-400">
                        <span>
                          {t('discountAmount', { value: d.type === "PERCENTAGE" ? `%${Number(d.value)}` : `${Number(d.value)} TL` })}
                        </span>
                        <span>{formatDate(d.validFrom)} - {formatDate(d.validUntil)}</span>
                        <span>
                          {t('usageCount', { used: d.usedCount, limit: d.usageLimit ? `/${d.usageLimit}` : "" })}
                        </span>
                        {d.minAmount && <span>{t('minLabel', { value: Number(d.minAmount) })}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(d)}
                    >
                      {d.isActive ? t('deactivate') : t('activate')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(d)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
