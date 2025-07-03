"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, ExternalLink, QrCode, Download, X, ChevronUp } from "lucide-react"
import { getTables, createTable, deleteTable, updateTable, Table, getOrders, API_URL } from "@/lib/api"
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
  const [lastOrders, setLastOrders] = useState<{[key: string]: Date}>({})
  const [newTable, setNewTable] = useState({
    number: "",
    seats: "",
    locationId: "",
  })
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string>("")
  const [tableDetailsOpen, setTableDetailsOpen] = useState<string | null>(null)
  const [tableOrders, setTableOrders] = useState<any[]>([])
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const { toast } = useToast()
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const TOUCH_THRESHOLD = 10; // pixels
  const TOUCH_TIME_THRESHOLD = 200; // milliseconds

  const getTimeElapsed = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  useEffect(() => {
    fetchTables()
    fetchLocations()
    fetchActiveOrders()
    fetchLastOrders()
    setQrUrl(window.location.origin)
  }, [])

  // Efecto para actualizar el tiempo cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(timer);
  }, []);

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
      const orders = await fetch(`${API_URL}/orders?kitchen=true`, {
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

  const fetchLastOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/orders?kitchen=true`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      const lastOrdersByTable: {[key: string]: Date} = {};
      
      data.forEach((order: any) => {
        if (order.tableId) {
          const orderDate = new Date(order.createdAt);
          if (!lastOrdersByTable[order.tableId] || orderDate > new Date(lastOrdersByTable[order.tableId])) {
            lastOrdersByTable[order.tableId] = order.createdAt;
          }
        }
      });
      
      setLastOrders(lastOrdersByTable);
    } catch (err) {
      console.error("Error al cargar las últimas órdenes:", err)
    }
  }

  const fetchTableOrders = async (tableId: string) => {
    try {
      const response = await fetch(`${API_URL}/orders?tableId=${tableId}`, {
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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchStartTime(Date.now());
  };

  const handleTouchEnd = (e: React.TouchEvent, tableId: string) => {
    if (!touchStartY || !touchStartTime) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = Math.abs(touchEndY - touchStartY);
    const deltaTime = touchEndTime - touchStartTime;

    // Solo abrir el Dialog si:
    // 1. El movimiento vertical es menor al umbral (no es scroll)
    // 2. El tiempo del toque es menor al umbral (es un toque rápido)
    if (deltaY < TOUCH_THRESHOLD && deltaTime < TOUCH_TIME_THRESHOLD) {
      setTableDetailsOpen(tableId);
      fetchTableOrders(tableId);
    }

    setTouchStartY(null);
    setTouchStartTime(null);
  };

  if (loading) {
    return <div className="text-center">Cargando mesas...</div>
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>
  }

  return (
    <div className="space-y-4 w-full">
      <Card className="w-full">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>
              {editingTable ? "Editar Mesa" : "Crear Nueva Mesa"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateFormVisible(!isCreateFormVisible)}
              className="flex items-center gap-2"
            >
              {isCreateFormVisible ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Contraer
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear Mesa
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {(isCreateFormVisible || editingTable) && (
          <CardContent className="pt-4">
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
                      onClick={() => {
                        setEditingTable(null);
                        setIsCreateFormVisible(false);
                      }}
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
        )}
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Mesas Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {tables.map((table) => {
              const isActive = activeOrders.some(order => order.tableId === table.id)
              const lastOrderDate = lastOrders[table.id];
              return (
                <div
                  key={table.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg hover:bg-muted/50 gap-2"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={(e) => handleTouchEnd(e, table.id)}
                  onClick={() => {
                    setTableDetailsOpen(table.id);
                    fetchTableOrders(table.id);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium">Mesa {table.number}</p>
                        <Badge variant={isActive ? "default" : "secondary"} className="h-5">
                          {isActive ? "Activa" : "Libre"}
                        </Badge>
                      </div>
                      {lastOrderDate && (
                        <Badge variant="outline" className="h-5 text-xs">
                          <span className="text-[10px] text-muted-foreground mr-1">Últ. orden:</span>
                          {getTimeElapsed(lastOrderDate)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        {table.seats} asientos
                      </p>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-sm text-muted-foreground">
                        {table.location?.name}
                      </p>
                    </div>
                  </div>
                  <div 
                    className="flex gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedTableId(table.id);
                              setShowQrDialog(true);
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

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
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
                            className="h-8 w-8"
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
                            className="h-8 w-8"
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
        onOpenChange={(open) => {
          if (!open) {
            setTableDetailsOpen(null);
          }
        }}
      >
        <DialogContent 
          className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col mx-auto w-[calc(100%-2rem)] md:w-[90%] lg:w-[80%] xl:w-[70%]"
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setTableDetailsOpen(null);
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setTableDetailsOpen(null);
          }}
        >
          <DialogClose 
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-[51]"
            onClick={(e) => {
              e.preventDefault();
              setTableDetailsOpen(null);
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <div className="sticky top-0 bg-background z-10 border-b">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-lg">
                {tables.find(t => t.id === tableDetailsOpen)?.number 
                  ? `Mesa ${tables.find(t => t.id === tableDetailsOpen)?.number}`
                  : 'Detalles de Mesa'}
              </DialogTitle>
            </DialogHeader>

            {/* Información de la mesa */}
            {tableDetailsOpen && (
              <div className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
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
                  {lastOrders[tableDetailsOpen] && (
                    <Badge variant="outline" className="h-6 text-xs">
                      <span className="text-[10px] text-muted-foreground mr-1">Últ. orden:</span>
                      {getTimeElapsed(lastOrders[tableDetailsOpen])}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tableOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-muted p-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="space-y-0.5">
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
                  
                  <div className="p-3">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex flex-wrap justify-between items-center gap-2">
                          <div className="space-y-0.5">
                            <p className="font-medium">{item.product.name}</p>
                            {item.productVariant && (
                              <div className="flex items-center gap-2 mt-1">
                                {item.productVariant.image && (
                                  <img src={item.productVariant.image} alt={item.productVariant.name} className="w-6 h-6 object-cover rounded" />
                                )}
                                <span className="text-xs font-medium">{item.productVariant.name}</span>
                                {typeof item.productVariant.price === 'number' && !isNaN(item.productVariant.price) && (
                                  <span className="text-xs text-muted-foreground">${item.productVariant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                                )}
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} x ${item.productVariant?.price ? item.productVariant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : item.product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground">
                                Notas: {item.notes}
                              </p>
                            )}
                            <Badge variant="outline" className="mt-0.5">
                              {item.status}
                            </Badge>
                          </div>
                          <Badge variant="secondary">
                            ${((item.productVariant?.price ?? item.product.price) * item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Total:</span>
                        <span className="font-bold">
                          ${order.items.reduce((total, item) => 
                            total + (item.quantity * item.product.price), 0
                          ).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {tableOrders.length === 0 && (
              <div className="text-center text-muted-foreground py-6">
                No hay órdenes para esta mesa
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para el código QR */}
      <Dialog 
        open={showQrDialog} 
        onOpenChange={(open) => {
          if (!open) {
            setShowQrDialog(false);
            setSelectedTableId(null);
          }
        }}
      >
        <DialogContent className="max-w-sm mx-auto w-[calc(100%-2rem)] md:w-[90%] lg:w-[80%] xl:w-[70%]">
          <DialogHeader>
            <DialogTitle>Código QR de la Mesa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg">
              {selectedTableId && (
                <QRCodeSVG
                  id={`qr-${selectedTableId}`}
                  value={`${qrUrl}/table/${selectedTableId}`}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>
            <Button
              onClick={() => selectedTableId && handleDownloadQR(selectedTableId)}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}