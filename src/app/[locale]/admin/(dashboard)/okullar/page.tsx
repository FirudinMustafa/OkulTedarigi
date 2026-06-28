"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { normalizeSearch } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, School, AlertTriangle, Copy, RefreshCw, KeyRound, Mail } from "lucide-react"

interface SchoolType {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  address: string | null
  phone: string | null
  email: string | null
  deliveryType: string
  password: string
  directorName: string | null
  directorEmail: string
  isActive: boolean
  _count: {
    classes: number
  }
}

export default function OkullarPage() {
  const t = useTranslations("admin.schools")
  const tf = useTranslations("admin.i18nFields")
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolType | null>(null)
  const [editingSchool, setEditingSchool] = useState<SchoolType | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [showTranslations, setShowTranslations] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    name_de: "",
    name_ar: "",
    address: "",
    phone: "",
    email: "",
    deliveryType: "SCHOOL_DELIVERY",
    directorName: "",
    directorEmail: "",
    directorPassword: "",
    password: ""
  })

  useEffect(() => {
    fetchSchools()
  }, [])

  const fetchSchools = async () => {
    try {
      const res = await fetch("/api/admin/schools", { credentials: 'include' })
      const data = await res.json()
      setSchools(data.schools || [])
    } catch (error) {
      console.error("Okullar yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    try {
      const url = editingSchool
        ? `/api/admin/schools/${editingSchool.id}`
        : "/api/admin/schools"

      // Bos sifreleri gonderme: directorPassword bos -> degismez; password bos ->
      // create'de otomatik uretilir, edit'te degismez.
      const { directorPassword, password, ...restData } = formData
      const payload: Record<string, unknown> = { ...restData }
      if (directorPassword.trim()) payload.directorPassword = directorPassword
      if (password.trim()) payload.password = password

      const res = await fetch(url, {
        method: editingSchool ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        fetchSchools()
        setDialogOpen(false)
        resetForm()
      } else {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error || t("saveFailed"))
      }
    } catch (error) {
      console.error("Kayit hatasi:", error)
      setFormError(t("genericError"))
    }
  }

  const handleEdit = (school: SchoolType) => {
    setEditingSchool(school)
    setFormError(null)
    setShowTranslations(Boolean(school.name_en || school.name_de || school.name_ar))
    setFormData({
      name: school.name,
      name_en: school.name_en || "",
      name_de: school.name_de || "",
      name_ar: school.name_ar || "",
      address: school.address || "",
      phone: school.phone || "",
      email: school.email || "",
      deliveryType: school.deliveryType,
      directorName: school.directorName || "",
      directorEmail: school.directorEmail,
      directorPassword: "",
      password: ""
    })
    setDialogOpen(true)
  }

  const openDeleteDialog = (school: SchoolType) => {
    setSchoolToDelete(school)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleDeactivate = async () => {
    if (!schoolToDelete) return
    try {
      await fetch(`/api/admin/schools/${schoolToDelete.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: false })
      })
      fetchSchools()
      setDeleteDialogOpen(false)
      setSchoolToDelete(null)
    } catch (error) {
      console.error("Pasife cekme hatasi:", error)
    }
  }

  const handlePermanentDelete = async () => {
    if (!schoolToDelete) return
    try {
      const res = await fetch(`/api/admin/schools/${schoolToDelete.id}`, {
        method: "DELETE",
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        fetchSchools()
        setDeleteDialogOpen(false)
        setSchoolToDelete(null)
      } else {
        setDeleteError(data.error || t("deleteFailed"))
      }
    } catch (error) {
      console.error("Silme hatasi:", error)
      setDeleteError(t("genericError"))
    }
  }

  const toggleActive = async (school: SchoolType) => {
    try {
      await fetch(`/api/admin/schools/${school.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: !school.isActive })
      })
      fetchSchools()
    } catch (error) {
      console.error("Guncelleme hatasi:", error)
    }
  }

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password)
  }

  const regeneratePassword = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/schools/${id}/regenerate-password`, {
        method: "POST",
        credentials: 'include'
      })
      if (res.ok) {
        fetchSchools()
      }
    } catch (error) {
      console.error("Sifre yenileme hatasi:", error)
    }
  }

  const resetForm = () => {
    setEditingSchool(null)
    setFormError(null)
    setShowTranslations(false)
    setFormData({
      name: "",
      name_en: "",
      name_de: "",
      name_ar: "",
      address: "",
      phone: "",
      email: "",
      deliveryType: "SCHOOL_DELIVERY",
      directorName: "",
      directorEmail: "",
      directorPassword: "",
      password: ""
    })
  }

  const q = normalizeSearch(searchTerm)
  const filteredSchools = schools.filter(s =>
    normalizeSearch(s.name).includes(q) ||
    (s.address ? normalizeSearch(s.address).includes(q) : false)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newSchool")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t("loading")}</div>
          ) : filteredSchools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <School className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t("empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colParentPassword")}</TableHead>
                  <TableHead>{t("colDirector")}</TableHead>
                  <TableHead>{t("colDelivery")}</TableHead>
                  <TableHead>{t("colClass")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {school.password}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyPassword(school.password)}
                          title={t("copy")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => regeneratePassword(school.id)}
                          title={t("regenerate")}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{school.directorName || "-"}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {school.directorEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {school.deliveryType === "CARGO" ? t("deliveryCargo") : t("deliverySchool")}
                    </TableCell>
                    <TableCell>{school._count.classes}</TableCell>
                    <TableCell>
                      <Badge
                        variant={school.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(school)}
                      >
                        {school.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(school)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(school)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSchool ? t("editSchool") : t("addSchool")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("fieldName")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowTranslations((v) => !v)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showTranslations ? "▾ " : "▸ "}{tf("translations")} {tf("optional")}
                  </button>
                  {showTranslations && (
                    <div className="mt-2 space-y-2 rounded-lg border bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{tf("translationsHint")}</p>
                      <div className="space-y-1">
                        <Label htmlFor="name_en" className="text-xs">{tf("en")}</Label>
                        <Input
                          id="name_en"
                          value={formData.name_en}
                          onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="name_de" className="text-xs">{tf("de")}</Label>
                        <Input
                          id="name_de"
                          value={formData.name_de}
                          onChange={(e) => setFormData({ ...formData, name_de: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="name_ar" className="text-xs">{tf("ar")}</Label>
                        <Input
                          id="name_ar"
                          dir="rtl"
                          value={formData.name_ar}
                          onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryType">{t("fieldDeliveryType")}</Label>
                  <Select
                    value={formData.deliveryType}
                    onValueChange={(value) => setFormData({ ...formData, deliveryType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHOOL_DELIVERY">{t("deliveryOptionSchool")}</SelectItem>
                      <SelectItem value="CARGO">{t("deliveryOptionCargo")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t("fieldAddress")}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("fieldPhone")}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("fieldEmail")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("fieldParentPassword")}</Label>
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value.toUpperCase() })}
                  placeholder={editingSchool ? t("passwordPlaceholderEdit") : t("passwordPlaceholderCreate")}
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">
                  {t("parentPasswordHint")}
                </p>
              </div>
              <div className="border-t pt-4 mt-2">
                <h4 className="font-medium mb-3">{t("directorInfo")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="directorName">{t("fieldDirectorName")}</Label>
                    <Input
                      id="directorName"
                      value={formData.directorName}
                      onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directorEmail">{t("fieldDirectorEmail")}</Label>
                    <Input
                      id="directorEmail"
                      type="email"
                      value={formData.directorEmail}
                      onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                      required
                    />
                    <p className="text-xs text-gray-500">{t("directorEmailMultiHint")}</p>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="directorPassword">
                    {editingSchool ? t("fieldNewPassword") : t("fieldPassword")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="directorPassword"
                      type="password"
                      value={formData.directorPassword}
                      onChange={(e) => setFormData({ ...formData, directorPassword: e.target.value })}
                      required={!editingSchool}
                      placeholder={editingSchool ? t("passwordPlaceholderEdit") : t("directorPasswordPlaceholder")}
                    />
                    {editingSchool && (
                      <KeyRound className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            {formError && (
              <div className="p-3 mb-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{formError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">
                {editingSchool ? t("update") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t("deleteTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              {t.rich("deletePrompt", { name: schoolToDelete?.name ?? "", strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
            {deleteError && (
              <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{deleteError}</p>
              </div>
            )}
            <div className="space-y-3">
              <div className="p-3 border rounded-lg hover:bg-gray-50">
                <p className="font-medium">{t("deactivate")}</p>
                <p className="text-sm text-gray-500">{t("deactivateDesc")}</p>
              </div>
              <div className="p-3 border rounded-lg border-red-200 hover:bg-red-50">
                <p className="font-medium text-red-600">{t("permanentDelete")}</p>
                <p className="text-sm text-gray-500">{t("permanentDeleteDesc")}</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="secondary" onClick={handleDeactivate}>
              {t("deactivate")}
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete}>
              {t("permanentDeleteShort")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
