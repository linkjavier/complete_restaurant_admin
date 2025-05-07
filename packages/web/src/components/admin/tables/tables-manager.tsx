"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, ExternalLink, QrCode, Download, X } from "lucide-react"
import { getTables, createTable, deleteTable, updateTable, Table, getOrders } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { getLocations, Location } from "@/lib/api"
import { QRCodeSVG } from 'qrcode.react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

export function TablesManager() {
  const [tables, setTables] = useState<Table[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [newTable, setNewTable] = useState({
    number: "",
    seats: "",
    locationId: "",
  })
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string>("")
  const [tableDetailsOpen, setTableDetailsOpen] = useState<string | null>(null)
  const [tableOrders, setTableOrders] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetchTables()
    fetchLocations()
    fetchActiveOrders()
    setQrUrl(window.location.origin)
  }, [])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const data = await getTables()
      setTables(data)
    } catch (err) {
      setError("Error al cargar las mesas")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const data = await getLocations()
      setLocations(data)
    } catch (err) {
      console.error("Error al cargar las ubicaciones:", err)
    }
  }

  const fetchActiveOrders = async () => {
    try {
      const orders = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders?kitchen=true`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!orders.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await orders.json();
      setActiveOrders(data.filter(order => 
        order.status === "PENDING" || 
        order.status === "IN_PROGRESS" || 
        order.status === "READY"
      ))
    } catch (err) {
      console.error("Error al cargar las órdenes activas:", err)
    }
  }

  const fetchTableOrders = async (tableId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders?tableId=${tableId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al obtener las órdenes');
      }

      const data = await response.json();
      setTableOrders(data);
    } catch (err) {
      console.error('Error fetching table orders:', err);
      toast({
        title: "Error",
        description: "Error al cargar las órdenes de la mesa",
        variant: "destructive",
      });
    }
  }

  const handleCreateTable = async () => {
    try {
      if (!newTable.number || !newTable.seats || !newTable.locationId) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos",
          variant: "destructive",
        })
        return
      }

      await createTable({
        number: parseInt(newTable.number),
        seats: parseInt(newTable.seats),
        locationId: newTable.locationId,
      })

      toast({
        title: "Éxito",
        description: "Mesa creada correctamente",
      })

      setNewTable({
        number: "",
        seats: "",
        locationId: "",
      })

      fetchTables()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error al crear la mesa",
        variant: "destructive",
      })
      console.error(err)
    }
  }

  const handleUpdateTable = async () => {
    if (!editingTable) return

    try {
      if (!editingTable.number || !editingTable.seats || !editingTable.locationId) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos",
          variant: "destructive",
        })
        return
      }

      await updateTable(editingTable.id, {
        number: editingTable.number,
        seats: editingTable.seats,
        locationId: editingTable.locationId,
      })

      toast({
        title: "Éxito",
        description: "Mesa actualizada correctamente",
      })

      setEditingTable(null)
      fetchTables()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error al actualizar la mesa",
        variant: "destructive",
      })
      console.error(err)
    }
  }

  const handleDeleteTable = async (id: string) => {
    try {
      await deleteTable(id)
      toast({
        title: "Éxito",
        description: "Mesa eliminada correctamente",
      })
      fetchTables()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error al eliminar la mesa",
        variant: "destructive",
      })
      console.error(err)
    }
  }

  const handleDownloadQR = (tableId: string) => {
    const svg = document.getElementById(`qr-${tableId}`)
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `qr-mesa-${tableId}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = "data:image/svg+xml;base64," + btoa(svgData)
  }

  if (loading) {
    return <div className="text-center">Cargando mesas...</div>
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingTable ? "Editar Mesa" : "Crear Nueva Mesa"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="number">Número de Mesa</Label>
              <Input
                id="number"
                type="number"
                value={editingTable ? editingTable.number : newTable.number}
                onChange={(e) =>
                  editingTable
                    ? setEditingTable({ ...editingTable, number: parseInt(e.target.value) })
                    : setNewTable({ ...newTable, number: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seats">Número de Asientos</Label>
              <Input
                id="seats"
                type="number"
                value={editingTable ? editingTable.seats : newTable.seats}
                onChange={(e) =>
                  editingTable
                    ? setEditingTable({ ...editingTable, seats: parseInt(e.target.value) })
                    : setNewTable({ ...newTable, seats: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="locationId">Ubicación</Label>
              <Select
                value={editingTable ? editingTable.locationId : newTable.locationId}
                onValueChange={(value) =>
                  editingTable
                    ? setEditingTable({ ...editingTable, locationId: value })
                    : setNewTable({ ...newTable, locationId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {editingTable ? (
                <>
                  <Button onClick={handleUpdateTable}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Mesa
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingTable(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateTable}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Mesa
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mesas Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {tables.map((table) => {
              const isActive = activeOrders.some(order => order.tableId === table.id)
              return (
                <div
                  key={table.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div
                    className="cursor-pointer flex-1"
                    onClick={() => {
                      setTableDetailsOpen(table.id);
                      fetchTableOrders(table.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Mesa {table.number}</p>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        ID: {table.id.substring(0, 8)}
                      </span>
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "Activa" : "Libre"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {table.seats} asientos
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ubicación: {table.location?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrDialogOpen(table.id);
                            }}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ver Código QR</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Dialog open={qrDialogOpen === table.id} onOpenChange={(open) => setQrDialogOpen(open ? table.id : null)}>
                      <DialogContent 
                        className="sm:max-w-md"
                        onPointerDownOutside={(e) => e.preventDefault()}
                      >
                        <DialogHeader>
                          <DialogTitle>Código QR - Mesa {table.number}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                          <QRCodeSVG
                            id={`qr-${table.id}`}
                            value={`${qrUrl}/table/${table.id}`}
                            size={200}
                            level="H"
                            includeMargin
                          />
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadQR(table.id);
                            }}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Descargar QR
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTable(table);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Editar Mesa</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(table.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Eliminar Mesa</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/table/${table.id}`, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Abrir Mesa</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog 
        open={!!tableDetailsOpen} 
        onOpenChange={(open) => !open && setTableDetailsOpen(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-[51]">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <div className="relative">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle>
                {tables.find(t => t.id === tableDetailsOpen)?.number 
                  ? `Detalles de Mesa ${tables.find(t => t.id === tableDetailsOpen)?.number}`
                  : 'Detalles de Mesa'}
              </DialogTitle>
            </DialogHeader>

            {/* Información de la mesa */}
            {tableDetailsOpen && (
              <div className="py-4 border-b">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Ubicación:</p>
                  <span className="text-sm text-muted-foreground">
                    {tables.find(t => t.id === tableDetailsOpen)?.location?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Asientos:</p>
                  <span className="text-sm text-muted-foreground">
                    {tables.find(t => t.id === tableDetailsOpen)?.seats}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 space-y-4">
            {tableOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-muted p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Orden #{order.id.substring(0, 8)} - {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Estado: {order.status}
                        </p>
                      </div>
                      {order.paymentMethod && (
                        <Badge>
                          {order.paymentMethod}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="space-y-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} x ${item.product.price.toFixed(2)}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground">
                                Notas: {item.notes}
                              </p>
                            )}
                            <Badge variant="outline" className="mt-1">
                              {item.status}
                            </Badge>
                          </div>
                          <Badge variant="secondary">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Total:</span>
                        <span className="font-bold">
                          ${order.items.reduce((total, item) => 
                            total + (item.quantity * item.product.price), 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {tableOrders.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No hay órdenes para esta mesa
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}