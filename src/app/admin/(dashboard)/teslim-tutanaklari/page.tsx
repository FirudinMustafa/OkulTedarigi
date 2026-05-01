"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Search, Calendar, User, Package, CheckCircle, ClipboardList, Download } from "lucide-react"
import { ORDER_STATUS_LABELS } from "@/lib/constants"

interface PendingOrder {
  id: string
  orderNumber: string
  studentName: string
  parentName: string
  phone: string
  status: string
  totalAmount: number
  createdAt: string
  class: {
    id: string
    name: string
    school: { id: string; name: string }
  }
  package: { name: string }
}

interface DeliveryDoc {
  id: string
  documentNo: string
  deliveryDate: string
  receivedBy: string
  totalPackages: number
  pdfPath: string | null
  schoolId: string | null
  classId: string | null
  notes: string | null
  createdAt: string
  orders: Array<{
    id: string
    orderNumber: string
    studentName: string
    parentName: string
    status: string
    totalAmount: number
    class: { name: string; school: { name: string } }
  }>
}

interface SchoolOption {
  id: string
  name: string
}

interface ClassOption {
  id: string
  name: string
  schoolId: string
}

export default function TeslimTutanaklariPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [documents, setDocuments] = useState<DeliveryDoc[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [filterSchool, setFilterSchool] = useState("")
  const [filterClass, setFilterClass] = useState("")
  const [receivedBy, setReceivedBy] = useState("")
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState("")
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (activeTab === 'create') {
      fetchPendingOrders()
    } else {
      fetchDocuments()
    }
  }, [activeTab, filterSchool, filterClass])

  const fetchPendingOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterSchool) params.set('schoolId', filterSchool)
      if (filterClass) params.set('classId', filterClass)
      const res = await fetch(`/api/admin/delivery-documents/pending?${params}`, { credentials: 'include' })
      const data = await res.json()
      setPendingOrders(data.orders || [])
      setSchools(data.schools || [])
      setClasses(data.classes || [])
    } catch (error) {
      console.error("Veri yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delivery-documents', { credentials: 'include' })
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error("Tutanaklar yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleOrder = (id: string) => {
    const newSet = new Set(selectedOrders)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedOrders(newSet)
  }

  const toggleAll = () => {
    if (selectedOrders.size === pendingOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(pendingOrders.map(o => o.id)))
    }
  }

  const handleSubmit = async () => {
    if (selectedOrders.size === 0) {
      setMessage({ type: 'error', text: 'Lutfen en az bir siparis secin' })
      return
    }
    if (!receivedBy.trim()) {
      setMessage({ type: 'error', text: 'Teslim alan kisi adi zorunludur' })
      return
    }
    if (!deliveryDate) {
      setMessage({ type: 'error', text: 'Teslim tarihi zorunludur' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/delivery-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          schoolId: filterSchool || null,
          classId: filterClass || null,
          orderIds: Array.from(selectedOrders),
          receivedBy: receivedBy.trim(),
          deliveryDate,
          notes: notes.trim() || null
        })
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `Teslim tutanagi olusturuldu: ${data.document.documentNo}` })
        setSelectedOrders(new Set())
        setReceivedBy("")
        setNotes("")
        fetchPendingOrders()
      } else {
        setMessage({ type: 'error', text: data.error || 'Hata olustu' })
      }
    } catch (error) {
      console.error("Tutanak olusturulamadi:", error)
      setMessage({ type: 'error', text: 'Bir hata olustu' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredClasses = filterSchool
    ? classes.filter(c => c.schoolId === filterSchool)
    : classes

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teslim Tutanaklari</h1>
          <p className="text-gray-500">Okula teslim edilen siparislerin tutanaklarini yonetin</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'create' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('create')}
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Tutanak Olustur
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('history')}
        >
          <FileText className="h-4 w-4 mr-2" />
          Tutanak Gecmisi
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {activeTab === 'create' ? (
        <div className="space-y-6">
          {/* Filtreler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Filtrele
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Okul</Label>
                  <Select value={filterSchool || "__all__"} onValueChange={(v) => { setFilterSchool(v === "__all__" ? "" : v); setFilterClass("") }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tum okullar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tum Okullar</SelectItem>
                      {schools.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sinif</Label>
                  <Select value={filterClass || "__all__"} onValueChange={(v) => setFilterClass(v === "__all__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tum siniflar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tum Siniflar</SelectItem>
                      {filteredClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teslim edilmemis siparisler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Teslim Bekleyen Siparisler ({pendingOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
              ) : pendingOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Teslim bekleyen siparis bulunamadi</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedOrders.size === pendingOrders.length && pendingOrders.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Siparis No</TableHead>
                      <TableHead>Ogrenci</TableHead>
                      <TableHead>Veli</TableHead>
                      <TableHead>Okul</TableHead>
                      <TableHead>Sinif</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => toggleOrder(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                        <TableCell className="font-medium">{order.studentName}</TableCell>
                        <TableCell>{order.parentName}</TableCell>
                        <TableCell>{order.class.school.name}</TableCell>
                        <TableCell>{order.class.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ORDER_STATUS_LABELS[order.status] || order.status}</Badge>
                        </TableCell>
                        <TableCell>{Number(order.totalAmount).toFixed(2)} TL</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Teslim bilgileri formu */}
          {selectedOrders.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Teslim Bilgileri ({selectedOrders.size} siparis secildi)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="receivedBy">
                      <User className="h-4 w-4 inline mr-1" />
                      Teslim Alan Kisi *
                    </Label>
                    <Input
                      id="receivedBy"
                      placeholder="Ad Soyad"
                      value={receivedBy}
                      onChange={(e) => setReceivedBy(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryDate">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Teslim Tarihi *
                    </Label>
                    <Input
                      id="deliveryDate"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    placeholder="Ek notlar (opsiyonel)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Olusturuluyor...' : 'Teslim Tutanagi Olustur'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Tutanak Gecmisi */
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Henuz teslim tutanagi bulunmuyor</p>
            </div>
          ) : (
            documents.map(doc => (
              <Card key={doc.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.documentNo}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {doc.pdfPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => window.open(doc.pdfPath!, '_blank')}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                      )}
                      <Badge>{doc.totalPackages} paket</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-500">Teslim Tarihi</p>
                      <p className="font-medium">{new Date(doc.deliveryDate).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Teslim Alan</p>
                      <p className="font-medium">{doc.receivedBy}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Olusturulma</p>
                      <p className="font-medium">{new Date(doc.createdAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                  {doc.notes && (
                    <p className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded">{doc.notes}</p>
                  )}
                  <div className="border rounded-lg divide-y">
                    <div className="grid grid-cols-4 gap-4 p-2 bg-gray-50 text-xs font-medium text-gray-500">
                      <span>Siparis No</span>
                      <span>Ogrenci</span>
                      <span>Okul / Sinif</span>
                      <span className="text-right">Tutar</span>
                    </div>
                    {doc.orders.map(order => (
                      <div key={order.id} className="grid grid-cols-4 gap-4 p-2 text-sm">
                        <span className="font-mono">{order.orderNumber}</span>
                        <span>{order.studentName}</span>
                        <span>{order.class.school.name} / {order.class.name}</span>
                        <span className="text-right font-medium">{Number(order.totalAmount).toFixed(2)} TL</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
