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
import { Plus, Edit, Trash2, Search, Users, AlertTriangle } from "lucide-react"

interface ClassType {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  commissionAmount: number | null
  school: { id: string; name: string; password: string }
  package: { id: string; name: string } | null
  isActive: boolean
  _count: { orders: number }
}

interface SchoolType {
  id: string
  name: string
}

interface PackageType {
  id: string
  name: string
}

export default function SiniflarPage() {
  const t = useTranslations("admin.classes")
  const tf = useTranslations("admin.i18nFields")
  const [classes, setClasses] = useState<ClassType[]>([])
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [packages, setPackages] = useState<PackageType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSchool, setFilterSchool] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<ClassType | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingClass, setEditingClass] = useState<ClassType | null>(null)
  const [showTranslations, setShowTranslations] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    name_de: "",
    name_ar: "",
    schoolId: "",
    packageId: "",
    commissionAmount: ""
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [classesRes, schoolsRes, packagesRes] = await Promise.all([
        fetch("/api/admin/classes", { credentials: 'include' }),
        fetch("/api/admin/schools", { credentials: 'include' }),
        fetch("/api/admin/packages", { credentials: 'include' })
      ])

      const [classesData, schoolsData, packagesData] = await Promise.all([
        classesRes.json(),
        schoolsRes.json(),
        packagesRes.json()
      ])

      setClasses(classesData.classes || [])
      setSchools(schoolsData.schools || [])
      setPackages(packagesData.packages || [])
    } catch (error) {
      console.error("Veri yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingClass
        ? `/api/admin/classes/${editingClass.id}`
        : "/api/admin/classes"

      const res = await fetch(url, {
        method: editingClass ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          commissionAmount: parseFloat(formData.commissionAmount) || 0
        })
      })

      if (res.ok) {
        fetchData()
        setDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error("Kayit hatasi:", error)
    }
  }

  const handleEdit = (cls: ClassType) => {
    setEditingClass(cls)
    setShowTranslations(Boolean(cls.name_en || cls.name_de || cls.name_ar))
    setFormData({
      name: cls.name,
      name_en: cls.name_en || "",
      name_de: cls.name_de || "",
      name_ar: cls.name_ar || "",
      schoolId: cls.school.id,
      packageId: cls.package?.id || "",
      commissionAmount: cls.commissionAmount?.toString() || ""
    })
    setDialogOpen(true)
  }

  const openDeleteDialog = (cls: ClassType) => {
    setClassToDelete(cls)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleDeactivate = async () => {
    if (!classToDelete) return
    try {
      await fetch(`/api/admin/classes/${classToDelete.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: false })
      })
      fetchData()
      setDeleteDialogOpen(false)
      setClassToDelete(null)
    } catch (error) {
      console.error("Pasife cekme hatasi:", error)
    }
  }

  const handlePermanentDelete = async () => {
    if (!classToDelete) return
    try {
      const res = await fetch(`/api/admin/classes/${classToDelete.id}`, {
        method: "DELETE",
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        fetchData()
        setDeleteDialogOpen(false)
        setClassToDelete(null)
      } else {
        setDeleteError(data.error || t("deleteFailed"))
      }
    } catch (error) {
      console.error("Silme hatasi:", error)
      setDeleteError(t("genericError"))
    }
  }

  const toggleActive = async (cls: ClassType) => {
    try {
      await fetch(`/api/admin/classes/${cls.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: !cls.isActive })
      })
      fetchData()
    } catch (error) {
      console.error("Guncelleme hatasi:", error)
    }
  }

  const resetForm = () => {
    setEditingClass(null)
    setShowTranslations(false)
    setFormData({
      name: "",
      name_en: "",
      name_de: "",
      name_ar: "",
      schoolId: "",
      packageId: "",
      commissionAmount: ""
    })
  }

  const q = normalizeSearch(searchTerm)
  const filteredClasses = classes.filter(c => {
    const matchesSearch = normalizeSearch(c.name).includes(q) ||
      normalizeSearch(c.school.name).includes(q)
    const matchesSchool = !filterSchool || c.school.id === filterSchool
    return matchesSearch && matchesSchool
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newClass")}
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
            <Select value={filterSchool || "__all__"} onValueChange={(val) => setFilterSchool(val === "__all__" ? "" : val)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("allSchools")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("allSchools")}</SelectItem>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t("loading")}</div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t("empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colSchool")}</TableHead>
                  <TableHead>{t("colSchoolPassword")}</TableHead>
                  <TableHead>{t("colCommission")}</TableHead>
                  <TableHead>{t("colPackage")}</TableHead>
                  <TableHead>{t("colOrders")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.school.name}</TableCell>
                    <TableCell>
                      <code className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-mono">
                        {cls.school.password}
                      </code>
                    </TableCell>
                    <TableCell>{cls.commissionAmount ? Number(cls.commissionAmount).toFixed(2) + ' TL' : '-'}</TableCell>
                    <TableCell>{cls.package?.name || "-"}</TableCell>
                    <TableCell>{cls._count.orders}</TableCell>
                    <TableCell>
                      <Badge
                        variant={cls.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(cls)}
                      >
                        {cls.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cls)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(cls)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClass ? t("editClass") : t("addClass")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("fieldName")}</Label>
                <Input
                  id="name"
                  placeholder={t("namePlaceholder")}
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
                <Label htmlFor="schoolId">{t("fieldSchool")}</Label>
                <Select
                  value={formData.schoolId}
                  onValueChange={(value) => setFormData({ ...formData, schoolId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectSchool")} />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageId">{t("fieldPackage")}</Label>
                <Select
                  value={formData.packageId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, packageId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectPackage")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("noPackage")}</SelectItem>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionAmount">{t("fieldCommission")}</Label>
                <Input
                  id="commissionAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t("commissionPlaceholder")}
                  value={formData.commissionAmount}
                  onChange={(e) => setFormData({ ...formData, commissionAmount: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">
                {editingClass ? t("update") : t("save")}
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
              {t.rich("deletePrompt", { name: classToDelete?.name ?? "", strong: (chunks) => <strong>{chunks}</strong> })}
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
