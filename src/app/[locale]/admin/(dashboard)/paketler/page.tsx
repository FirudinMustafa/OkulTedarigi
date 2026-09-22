"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { normalizeSearch } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, Package, Eye, AlertTriangle } from "lucide-react"

interface PackageItem {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  quantity: number
  unitPrice: number
}

interface PackageType {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  description: string | null
  description_en?: string | null
  description_de?: string | null
  description_ar?: string | null
  note: string | null
  note_en?: string | null
  note_de?: string | null
  note_ar?: string | null
  basePrice: number
  isActive: boolean
  isCustomizable?: boolean
  items: PackageItem[]
  _count: { classes: number }
}

export default function PaketlerPage() {
  const t = useTranslations("admin.packages")
  const tf = useTranslations("admin.i18nFields")
  const [packages, setPackages] = useState<PackageType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [packageToDelete, setPackageToDelete] = useState<PackageType | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingPackage, setEditingPackage] = useState<PackageType | null>(null)
  const [viewingPackage, setViewingPackage] = useState<PackageType | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    name_de: "",
    name_ar: "",
    description: "",
    description_en: "",
    description_de: "",
    description_ar: "",
    note: "",
    note_en: "",
    note_de: "",
    note_ar: "",
    basePrice: "",
    isCustomizable: false
  })
  const [items, setItems] = useState<{
    name: string
    name_en: string
    name_de: string
    name_ar: string
    quantity: string
    unitPrice: string
  }[]>([
    { name: "", name_en: "", name_de: "", name_ar: "", quantity: "1", unitPrice: "" }
  ])

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const res = await fetch("/api/admin/packages", { credentials: 'include' })
      const data = await res.json()
      setPackages(data.packages || [])
    } catch (error) {
      console.error("Paketler yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validItems = items.filter(item => item.name.trim() !== "")

    try {
      const url = editingPackage
        ? `/api/admin/packages/${editingPackage.id}`
        : "/api/admin/packages"

      const res = await fetch(url, {
        method: editingPackage ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          name_en: formData.name_en,
          name_de: formData.name_de,
          name_ar: formData.name_ar,
          description: formData.description,
          description_en: formData.description_en,
          description_de: formData.description_de,
          description_ar: formData.description_ar,
          note: formData.note,
          note_en: formData.note_en,
          note_de: formData.note_de,
          note_ar: formData.note_ar,
          basePrice: parseFloat(formData.basePrice) || 0,
          isCustomizable: formData.isCustomizable,
          items: validItems.map(item => ({
            name: item.name,
            name_en: item.name_en,
            name_de: item.name_de,
            name_ar: item.name_ar,
            quantity: parseInt(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0
          }))
        })
      })

      if (res.ok) {
        fetchPackages()
        setDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error("Kayit hatasi:", error)
    }
  }

  const handleEdit = (pkg: PackageType) => {
    setEditingPackage(pkg)
    setFormData({
      name: pkg.name,
      name_en: pkg.name_en || "",
      name_de: pkg.name_de || "",
      name_ar: pkg.name_ar || "",
      description: pkg.description || "",
      description_en: pkg.description_en || "",
      description_de: pkg.description_de || "",
      description_ar: pkg.description_ar || "",
      note: pkg.note || "",
      note_en: pkg.note_en || "",
      note_de: pkg.note_de || "",
      note_ar: pkg.note_ar || "",
      basePrice: pkg.basePrice.toString(),
      isCustomizable: pkg.isCustomizable ?? false
    })
    setItems(
      pkg.items.length > 0
        ? pkg.items.map(item => ({
            name: item.name,
            name_en: item.name_en || "",
            name_de: item.name_de || "",
            name_ar: item.name_ar || "",
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString()
          }))
        : [{ name: "", name_en: "", name_de: "", name_ar: "", quantity: "1", unitPrice: "" }]
    )
    setDialogOpen(true)
  }

  const openDeleteDialog = (pkg: PackageType) => {
    setPackageToDelete(pkg)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleDeactivate = async () => {
    if (!packageToDelete) return
    try {
      await fetch(`/api/admin/packages/${packageToDelete.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: false })
      })
      fetchPackages()
      setDeleteDialogOpen(false)
      setPackageToDelete(null)
    } catch (error) {
      console.error("Pasife cekme hatasi:", error)
    }
  }

  const handlePermanentDelete = async () => {
    if (!packageToDelete) return
    try {
      const res = await fetch(`/api/admin/packages/${packageToDelete.id}`, {
        method: "DELETE",
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        fetchPackages()
        setDeleteDialogOpen(false)
        setPackageToDelete(null)
      } else {
        setDeleteError(data.error || t("deleteFailed"))
      }
    } catch (error) {
      console.error("Silme hatasi:", error)
      setDeleteError(t("genericError"))
    }
  }

  const toggleActive = async (pkg: PackageType) => {
    try {
      await fetch(`/api/admin/packages/${pkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive: !pkg.isActive })
      })
      fetchPackages()
    } catch (error) {
      console.error("Guncelleme hatasi:", error)
    }
  }

  const resetForm = () => {
    setEditingPackage(null)
    setFormData({
      name: "",
      name_en: "",
      name_de: "",
      name_ar: "",
      description: "",
      description_en: "",
      description_de: "",
      description_ar: "",
      note: "",
      note_en: "",
      note_de: "",
      note_ar: "",
      basePrice: "",
      isCustomizable: false
    })
    setItems([{ name: "", name_en: "", name_de: "", name_ar: "", quantity: "1", unitPrice: "" }])
  }

  const addItem = () => {
    setItems([...items, { name: "", name_en: "", name_de: "", name_ar: "", quantity: "1", unitPrice: "" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const q = normalizeSearch(searchTerm)
  const filteredPackages = packages.filter(p =>
    normalizeSearch(p.name).includes(q)
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
          {t("newPackage")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t("loading")}</div>
          ) : filteredPackages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t("empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colDescription")}</TableHead>
                  <TableHead>{t("colPrice")}</TableHead>
                  <TableHead>{t("colItemCount")}</TableHead>
                  <TableHead>{t("colClassCount")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{pkg.name}</span>
                        {pkg.isCustomizable && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">{t("customizable")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {pkg.description || "-"}
                    </TableCell>
                    <TableCell>{Number(pkg.basePrice).toFixed(2)} TL</TableCell>
                    <TableCell>{pkg.items.length}</TableCell>
                    <TableCell>{pkg._count.classes}</TableCell>
                    <TableCell>
                      <Badge
                        variant={pkg.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(pkg)}
                      >
                        {pkg.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setViewingPackage(pkg); setDetailDialogOpen(true) }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(pkg)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(pkg)}
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

      {/* Paket Detay Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewingPackage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {viewingPackage?.description && (
              <p className="text-gray-600">{viewingPackage.description}</p>
            )}
            {viewingPackage?.note && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <p className="text-sm font-medium text-yellow-800 mb-1">{t("packageNote")}</p>
                <p className="text-sm text-yellow-700">{viewingPackage.note}</p>
              </div>
            )}
            <div>
              <h4 className="font-medium mb-2">{t("packageContents")}</h4>
              <div className="border rounded-lg divide-y">
                {viewingPackage?.items.map((item) => (
                  <div key={item.id} className="p-3 flex justify-between">
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span className="font-medium">
                      {Number(item.unitPrice).toFixed(2)} TL
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg flex justify-between font-medium">
                <span>{t("totalPrice")}</span>
                <span>{Number(viewingPackage?.basePrice).toFixed(2)} TL</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Paket Ekleme/Duzenleme Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? t("editPackage") : t("addPackage")}
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basePrice">{t("fieldBasePrice")}</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("fieldDescription")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">{t("packageNote")}</Label>
                <Textarea
                  id="note"
                  placeholder={t("notePlaceholder")}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Ceviriler (EN/DE/AR) - opsiyonel */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {tf("translations")} <span className="text-gray-400 font-normal">{tf("optional")}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{tf("translationsHint")}</p>
                </div>

                {/* Paket adi cevirileri */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">{t("fieldName")}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder={tf("en")}
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    />
                    <Input
                      placeholder={tf("de")}
                      value={formData.name_de}
                      onChange={(e) => setFormData({ ...formData, name_de: e.target.value })}
                    />
                    <Input
                      placeholder={tf("ar")}
                      dir="rtl"
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    />
                  </div>
                </div>

                {/* Aciklama cevirileri */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">{t("fieldDescription")}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Textarea
                      placeholder={tf("en")}
                      rows={2}
                      value={formData.description_en}
                      onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    />
                    <Textarea
                      placeholder={tf("de")}
                      rows={2}
                      value={formData.description_de}
                      onChange={(e) => setFormData({ ...formData, description_de: e.target.value })}
                    />
                    <Textarea
                      placeholder={tf("ar")}
                      dir="rtl"
                      rows={2}
                      value={formData.description_ar}
                      onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    />
                  </div>
                </div>

                {/* Not cevirileri */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">{t("packageNote")}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Textarea
                      placeholder={tf("en")}
                      rows={2}
                      value={formData.note_en}
                      onChange={(e) => setFormData({ ...formData, note_en: e.target.value })}
                    />
                    <Textarea
                      placeholder={tf("de")}
                      rows={2}
                      value={formData.note_de}
                      onChange={(e) => setFormData({ ...formData, note_de: e.target.value })}
                    />
                    <Textarea
                      placeholder={tf("ar")}
                      dir="rtl"
                      rows={2}
                      value={formData.note_ar}
                      onChange={(e) => setFormData({ ...formData, note_ar: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Ozellestirilebilir */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <input
                  id="isCustomizable"
                  type="checkbox"
                  checked={formData.isCustomizable}
                  onChange={(e) => setFormData({ ...formData, isCustomizable: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isCustomizable" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">{t("customizableLabel")}</span>
                  <span className="block text-gray-500 mt-0.5">
                    {t("customizableHint")}
                  </span>
                </label>
              </div>

              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{t("packageContents")}</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("addItem")}
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="space-y-2 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          placeholder={t("itemName")}
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          className="flex-1 min-w-[140px]"
                        />
                        <Input
                          placeholder={t("itemQuantity")}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          className="w-20"
                        />
                        <Input
                          placeholder={t("itemPrice")}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                          className="w-24"
                        />
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                      {/* Urun adi cevirileri (EN/DE/AR) - opsiyonel */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-1">
                        <Input
                          placeholder={`${tf("en")} ${tf("optional")}`}
                          value={item.name_en}
                          onChange={(e) => updateItem(index, "name_en", e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder={`${tf("de")} ${tf("optional")}`}
                          value={item.name_de}
                          onChange={(e) => updateItem(index, "name_de", e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder={`${tf("ar")} ${tf("optional")}`}
                          dir="rtl"
                          value={item.name_ar}
                          onChange={(e) => updateItem(index, "name_ar", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">
                {editingPackage ? t("update") : t("save")}
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
              {t.rich("deletePrompt", { name: packageToDelete?.name ?? "", strong: (chunks) => <strong>{chunks}</strong> })}
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
