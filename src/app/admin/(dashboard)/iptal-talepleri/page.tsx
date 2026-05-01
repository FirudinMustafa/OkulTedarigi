"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Search, XCircle, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface CancelRequest {
  id: string
  reason: string
  status: string
  adminNote: string | null
  createdAt: string
  processedAt: string | null
  order: {
    id: string
    orderNumber: string
    studentName: string
    parentName: string
    parentPhone: string
    totalAmount: number
    class: {
      name: string
      school: { name: string }
    }
  }
}

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylandi",
  REJECTED: "Reddedildi"
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800"
}

export default function IptalTalepleriPage() {
  const [requests, setRequests] = useState<CancelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [processDialogOpen, setProcessDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CancelRequest | null>(null)
  const [adminNote, setAdminNote] = useState("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/admin/cancel-requests", { credentials: 'include' })
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error("Iptal talepleri yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const processRequest = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/cancel-requests/${selectedRequest.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ status, adminNote })
      })

      if (res.ok) {
        fetchRequests()
        setProcessDialogOpen(false)
        setAdminNote("")
      } else {
        const data = await res.json()
        alert(data.error || "Islem yapilamadi")
      }
    } catch (error) {
      console.error("Islem hatasi:", error)
      alert("Bir hata olustu. Lutfen tekrar deneyin.")
    } finally {
      setProcessing(false)
    }
  }

  const filteredRequests = requests.filter(r => {
    const matchesSearch =
      r.order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.order.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.order.parentName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || r.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const pendingCount = requests.filter(r => r.status === "PENDING").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Iptal Talepleri</h1>
          <p className="text-gray-500">Siparis iptal taleplerini yonetin</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4 mr-1" />
            {pendingCount} bekleyen talep
          </Badge>
        )}
      </div>

      {/* Ozet Kartlari */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Bekleyen
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {requests.filter(r => r.status === "PENDING").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Onaylanan
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {requests.filter(r => r.status === "APPROVED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Reddedilen
            </CardTitle>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {requests.filter(r => r.status === "REJECTED").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Talepler Listesi */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Siparis no, ogrenci veya veli ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus || "__all__"} onValueChange={(val) => setFilterStatus(val === "__all__" ? "" : val)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tum durumlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tumu</SelectItem>
                <SelectItem value="PENDING">Bekliyor</SelectItem>
                <SelectItem value="APPROVED">Onaylandi</SelectItem>
                <SelectItem value="REJECTED">Reddedildi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Iptal talebi bulunamadi</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Siparis No</TableHead>
                  <TableHead>Ogrenci / Veli</TableHead>
                  <TableHead>Okul / Sinif</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Iptal Nedeni</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">Islem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {request.order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.order.studentName}</p>
                        <p className="text-sm text-gray-500">{request.order.parentName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{request.order.class.school.name}</p>
                        <p className="text-sm text-gray-500">{request.order.class.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(request.order.totalAmount).toFixed(2)} TL
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.reason}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status] || ""}>
                        {statusLabels[request.status] || request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDateTime(request.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request)
                            setProcessDialogOpen(true)
                          }}
                        >
                          Islem Yap
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Islem Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Iptal Talebi Islemi</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Siparis No:</span>
                  <span className="font-mono">{selectedRequest.order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ogrenci:</span>
                  <span>{selectedRequest.order.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tutar:</span>
                  <span className="font-medium">
                    {Number(selectedRequest.order.totalAmount).toFixed(2)} TL
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Iptal Nedeni:</label>
                <p className="mt-1 p-3 bg-yellow-50 rounded-lg text-sm">
                  {selectedRequest.reason}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Admin Notu (Opsiyonel):</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Islem ile ilgili not ekleyin..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setProcessDialogOpen(false)}
              disabled={processing}
            >
              Vazgec
            </Button>
            <Button
              variant="destructive"
              onClick={() => processRequest("REJECTED")}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reddet
            </Button>
            <Button
              onClick={() => processRequest("APPROVED")}
              disabled={processing}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Onayla ve Iade Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
