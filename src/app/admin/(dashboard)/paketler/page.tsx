"use client"

import { useState, useEffect } from "react"
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
  quantity: number
  unitPrice: number
}

interface PackageType {
  id: string
  name: string
  description: string | null
  note: string | null
  basePrice: number
  isActive: boolean
  items: PackageItem[]
  _count: { classes: number }
}

export default function PaketlerPage() {
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
    description: "",
    note: "",
    basePrice: ""
  })
  const [items, setItems] = useState<{ name: string; quantity: string; unitPrice: string }[]>([
    { name: "", quantity: "1", unitPrice: "" }
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
          description: formData.description,
          note: formData.note,
          basePrice: parseFloat(formData.basePrice) || 0,
          items: validItems.map(item => ({
            name: item.name,
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
      description: pkg.description || "",
      note: pkg.note || "",
      basePrice: pkg.basePrice.toString()
    })
    setItems(
      pkg.items.length > 0
        ? pkg.items.map(item => ({
            name: item.name,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString()
          }))
        : [{ name: "", quantity: "1", unitPrice: "" }]
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
        setDeleteError(data.error || "Paket silinemedi")
      }
    } catch (error) {
      console.error("Silme hatasi:", error)
      setDeleteError("Bir hata olustu. Lutfen tekrar deneyin.")
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
      description: "",
      note: "",
      basePrice: ""
    })
    setItems([{ name: "", quantity: "1", unitPrice: "" }])
  }

  const addItem = () => {
    setItems([...items, { name: "", quantity: "1", unitPrice: "" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const filteredPackages = packages.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paketler</h1>
          <p className="text-gray-500">Urun paketi yonetimi</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Paket
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Paket ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
          ) : filteredPackages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Henuz paket eklenmemis</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paket Adi</TableHead>
                  <TableHead>Aciklama</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Urun Sayisi</TableHead>
                  <TableHead>Sinif Sayisi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Islemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
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
                        {pkg.isActive ? "Aktif" : "Pasif"}
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
                <p className="text-sm font-medium text-yellow-800 mb-1">Paket Notu</p>
                <p className="text-sm text-yellow-700">{viewingPackage.note}</p>
              </div>
            )}
            <div>
              <h4 className="font-medium mb-2">Paket Icerigi</h4>
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
                <span>Toplam Fiyat</span>
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
              {editingPackage ? "Paket Duzenle" : "Yeni Paket Ekle"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Paket Adi *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Toplam Fiyat (TL) *</Label>
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
                <Label htmlFor="description">Aciklama</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Paket Notu</Label>
                <Textarea
                  id="note"
                  placeholder="Veliye gosterilecek not (opsiyonel)"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Paket Icerigi</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Urun Ekle
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Urun adi"
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Adet"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        className="w-20"
                      />
                      <Input
                        placeholder="Fiyat"
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
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Iptal
              </Button>
              <Button type="submit">
                {editingPackage ? "Guncelle" : "Kaydet"}
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
              Paketi Kaldirmak Istiyor musunuz?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              <strong>{packageToDelete?.name}</strong> paketini kaldirmak istiyorsunuz. Ne yapmak istediginizi secin:
            </p>
            {deleteError && (
              <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{deleteError}</p>
              </div>
            )}
            <div className="space-y-3">
              <div className="p-3 border rounded-lg hover:bg-gray-50">
                <p className="font-medium">Pasife Cek</p>
                <p className="text-sm text-gray-500">Paket sistemde kalir ancak yeni siparis alinamaz. Daha sonra tekrar aktif edilebilir.</p>
              </div>
              <div className="p-3 border rounded-lg border-red-200 hover:bg-red-50">
                <p className="font-medium text-red-600">Kalici Olarak Sil</p>
                <p className="text-sm text-gray-500">Paket ve tum iliskili veriler kalici olarak silinir. Bu islem geri alinamaz.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Iptal
            </Button>
            <Button variant="secondary" onClick={handleDeactivate}>
              Pasife Cek
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete}>
              Kalici Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
