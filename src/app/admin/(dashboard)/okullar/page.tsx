"use client"

import { useState, useEffect } from "react"
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
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolType | null>(null)
  const [editingSchool, setEditingSchool] = useState<SchoolType | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    deliveryType: "SCHOOL_DELIVERY",
    directorName: "",
    directorEmail: "",
    directorPassword: ""
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

    try {
      const url = editingSchool
        ? `/api/admin/schools/${editingSchool.id}`
        : "/api/admin/schools"

      // Duzenleme sirasinda bos sifre gonderme
      const { directorPassword, ...restData } = formData
      const payload = directorPassword.trim()
        ? { ...restData, directorPassword }
        : restData

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
      }
    } catch (error) {
      console.error("Kayit hatasi:", error)
    }
  }

  const handleEdit = (school: SchoolType) => {
    setEditingSchool(school)
    setFormData({
      name: school.name,
      address: school.address || "",
      phone: school.phone || "",
      email: school.email || "",
      deliveryType: school.deliveryType,
      directorName: school.directorName || "",
      directorEmail: school.directorEmail,
      directorPassword: ""
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
        setDeleteError(data.error || "Okul silinemedi")
      }
    } catch (error) {
      console.error("Silme hatasi:", error)
      setDeleteError("Bir hata olustu. Lutfen tekrar deneyin.")
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
    setFormData({
      name: "",
      address: "",
      phone: "",
      email: "",
      deliveryType: "SCHOOL_DELIVERY",
      directorName: "",
      directorEmail: "",
      directorPassword: ""
    })
  }

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Okullar</h1>
          <p className="text-gray-500">Okul yonetimi</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Okul
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Okul ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
          ) : filteredSchools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <School className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Henuz okul eklenmemis</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul Adi</TableHead>
                  <TableHead>Veli Sifresi</TableHead>
                  <TableHead>Mudur</TableHead>
                  <TableHead>Teslimat</TableHead>
                  <TableHead>Sinif</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Islemler</TableHead>
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
                          title="Kopyala"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => regeneratePassword(school.id)}
                          title="Yenile"
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
                      {school.deliveryType === "CARGO" ? "Kargo" : "Okula"}
                    </TableCell>
                    <TableCell>{school._count.classes}</TableCell>
                    <TableCell>
                      <Badge
                        variant={school.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(school)}
                      >
                        {school.isActive ? "Aktif" : "Pasif"}
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
              {editingSchool ? "Okul Duzenle" : "Yeni Okul Ekle"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Okul Adi *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryType">Teslimat Tipi</Label>
                  <Select
                    value={formData.deliveryType}
                    onValueChange={(value) => setFormData({ ...formData, deliveryType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHOOL_DELIVERY">Okula Teslim</SelectItem>
                      <SelectItem value="CARGO">Kargo ile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <h4 className="font-medium mb-3">Mudur Bilgileri</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="directorName">Ad Soyad</Label>
                    <Input
                      id="directorName"
                      value={formData.directorName}
                      onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directorEmail">E-posta (Giris icin) *</Label>
                    <Input
                      id="directorEmail"
                      type="email"
                      value={formData.directorEmail}
                      onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="directorPassword">
                    {editingSchool ? "Yeni Sifre (degistirmek icin doldurun)" : "Sifre *"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="directorPassword"
                      type="password"
                      value={formData.directorPassword}
                      onChange={(e) => setFormData({ ...formData, directorPassword: e.target.value })}
                      required={!editingSchool}
                      placeholder={editingSchool ? "Bos birakirsaniz degismez" : "Mudur giris sifresi"}
                    />
                    {editingSchool && (
                      <KeyRound className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Iptal
              </Button>
              <Button type="submit">
                {editingSchool ? "Guncelle" : "Kaydet"}
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
              Okulu Kaldirmak Istiyor musunuz?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              <strong>{schoolToDelete?.name}</strong> okulunu kaldirmak istiyorsunuz. Ne yapmak istediginizi secin:
            </p>
            {deleteError && (
              <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{deleteError}</p>
              </div>
            )}
            <div className="space-y-3">
              <div className="p-3 border rounded-lg hover:bg-gray-50">
                <p className="font-medium">Pasife Cek</p>
                <p className="text-sm text-gray-500">Okul sistemde kalir ancak yeni islem yapilamaz. Daha sonra tekrar aktif edilebilir.</p>
              </div>
              <div className="p-3 border rounded-lg border-red-200 hover:bg-red-50">
                <p className="font-medium text-red-600">Kalici Olarak Sil</p>
                <p className="text-sm text-gray-500">Okul ve tum iliskili veriler kalici olarak silinir. Bu islem geri alinamaz.</p>
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
