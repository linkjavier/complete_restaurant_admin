"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  QrCode,
  Download,
  X,
  ChevronUp,
  Clock3,
  Search,
  LayoutGrid,
  List,
  FileText,
  RefreshCw,
} from "lucide-react"
import {
  getTables,
  createTable,
  deleteTable,
  updateTable,
  Table,
  API_URL,
  getTableShiftActivity,
  TableShift,
  TableShiftActivityOrder,
} from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { toFiniteInteger } from "@/lib/utils"
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
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

type TableOrder = TableShiftActivityOrder
type ActivityView = "mosaic" | "list" | "details"

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount)

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const formatDuration = (start: string | Date, end: string | Date) => {
  const minutes = Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
  )
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

export function TablesManager() {
  const [tables, setTables] = useState<Table[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeOrders, setActiveOrders] = useState<Array<{ tableId?: string }>>([])
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
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([])
  const [activeShift, setActiveShift] = useState<TableShift | null>(null)
  const [openAccountStartedAt, setOpenAccountStartedAt] = useState<string | null>(null)
  const [openAccountOrderCount, setOpenAccountOrderCount] = useState(0)
  const [openAccountTotal, setOpenAccountTotal] = useState(0)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityView, setActivityView] = useState<ActivityView>("mosaic")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [paymentFilter, setPaymentFilter] = useState("ALL")
  const [orderSearch, setOrderSearch] = useState("")
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
      
      data.forEach((order: { tableId?: string; createdAt: string }) => {
        if (order.tableId) {
          const orderDate = new Date(order.createdAt);
          if (!lastOrdersByTable[order.tableId] || orderDate > new Date(lastOrdersByTable[order.tableId])) {
            lastOrdersByTable[order.tableId] = orderDate;
          }
        }
      });
      
      setLastOrders(lastOrdersByTable);
    } catch (err) {
      console.error("Error al cargar las últimas órdenes:", err)
    }
  }

  const fetchTableOrders = async (tableId: string) => {
    setActivityLoading(true)
    setActiveShift(null)
    try {
      const activity = await getTableShiftActivity(tableId)
      setActiveShift(activity.shift)
      setTableOrders(activity.orders)
      setOpenAccountStartedAt(activity.openAccountStartedAt)
      setOpenAccountOrderCount(activity.openAccountOrderCount)
      setOpenAccountTotal(activity.openAccountTotal)
    } catch (err) {
      console.error('Error fetching table orders:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error al cargar la actividad de la mesa",
        variant: "destructive",
      });
    } finally {
      setActivityLoading(false)
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

  const openTableActivity = (tableId: string) => {
    setTableDetailsOpen(tableId)
    setTableOrders([])
    setOpenAccountStartedAt(null)
    setOpenAccountOrderCount(0)
    setOpenAccountTotal(0)
    setOrderSearch("")
    setStatusFilter("ALL")
    setPaymentFilter("ALL")
    void fetchTableOrders(tableId)
  }

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
      openTableActivity(tableId);
    }

    setTouchStartY(null);
    setTouchStartTime(null);
  };

  const visibleOrders = useMemo(() => {
    const term = orderSearch.trim().toLocaleLowerCase("es");
    return tableOrders.filter((order) => {
      const matchesStatus = statusFilter === "ALL" || order.status === statusFilter
      const matchesPayment =
        paymentFilter === "ALL" ||
        (paymentFilter === "PAID" ? order.isPaid : !order.isPaid)
      const searchableText = [
        order.id,
        order.customerName ?? "",
        ...order.items.map((item) => item.product.name),
        ...order.items.flatMap((item) =>
          item.variants.map((variant) => variant.productVariant.name),
        ),
      ].join(" ").toLocaleLowerCase("es")
      return (
        matchesStatus &&
        matchesPayment &&
        (!term || searchableText.includes(term))
      )
    })
  }, [orderSearch, paymentFilter, statusFilter, tableOrders])

  const getOrderTotal = (order: TableOrder) =>
    order.total ??
    order.items.reduce(
      (total, item) => total + (item.price ?? item.product.price) * item.quantity,
      0,
    )

  const getAccountDuration = (order: TableOrder) => {
    if (order.tableAccountSession) {
      return formatDuration(
        order.tableAccountSession.startedAt,
        order.tableAccountSession.endedAt,
      )
    }
    return openAccountStartedAt
      ? `${formatDuration(openAccountStartedAt, currentTime)} · abierta`
      : "En curso"
  }

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
                      ? setEditingTable({ ...editingTable, number: toFiniteInteger(e.target.value, editingTable.number) })
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
                      ? setEditingTable({ ...editingTable, seats: toFiniteInteger(e.target.value, editingTable.seats) })
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
                    openTableActivity(table.id)
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
          className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden p-0 sm:w-[94%]"
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
            className="absolute right-4 top-4 z-[51] rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            onClick={(e) => {
              e.preventDefault();
              setTableDetailsOpen(null);
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <div className="border-b bg-background px-5 pb-4 pt-5">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-xl">
                {tables.find((table) => table.id === tableDetailsOpen)?.number
                  ? `Actividad de Mesa ${tables.find((table) => table.id === tableDetailsOpen)?.number}`
                  : "Actividad de mesa"}
              </DialogTitle>
              <DialogDescription>
                Órdenes registradas durante el turno abierto de esta sede.
              </DialogDescription>
            </DialogHeader>

            {tableDetailsOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>
                  {tables.find((table) => table.id === tableDetailsOpen)?.location?.name}
                </span>
                <span>
                  {tables.find((table) => table.id === tableDetailsOpen)?.seats} puestos
                </span>
                {activeShift && (
                  <Badge variant="outline">
                    Turno desde {formatDateTime(activeShift.startedAt)}
                  </Badge>
                )}
                {lastOrders[tableDetailsOpen] && (
                  <Badge variant="outline">
                    Última orden hace {getTimeElapsed(lastOrders[tableDetailsOpen])}
                  </Badge>
                )}
                {openAccountStartedAt && (
                  <Badge variant="secondary">
                    Cuenta abierta · {formatDuration(openAccountStartedAt, currentTime)}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={activityLoading}
                  onClick={() => void fetchTableOrders(tableDetailsOpen)}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${activityLoading ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
              </div>
            )}

            {activeShift && (
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Órdenes del turno</p>
                  <p className="mt-1 text-lg font-semibold">{tableOrders.length}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Valor registrado</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrency(tableOrders.reduce((sum, order) => sum + getOrderTotal(order), 0))}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Pagadas</p>
                  <p className="mt-1 text-lg font-semibold">
                    {tableOrders.filter((order) => order.isPaid).length}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Permanencia de cuenta actual</p>
                  <p className="mt-1 text-lg font-semibold">
                    {openAccountStartedAt
                      ? formatDuration(openAccountStartedAt, currentTime)
                      : "Sin cuenta abierta"}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Órdenes cuenta actual</p>
                  <p className="mt-1 text-lg font-semibold">{openAccountOrderCount}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Total cuenta actual</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrency(openAccountTotal)}</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-center">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Buscar por orden, cliente o producto"
                  className="pl-9"
                  aria-label="Buscar órdenes"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full xl:w-48">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
                    <SelectItem key={status} value={status}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full xl:w-40">
                  <SelectValue placeholder="Pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los pagos</SelectItem>
                  <SelectItem value="PAID">Pagadas</SelectItem>
                  <SelectItem value="UNPAID">Pendientes de pago</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant={activityView === "mosaic" ? "default" : "outline"}
                  size="icon"
                  aria-label="Vista mosaico"
                  title="Vista mosaico"
                  onClick={() => setActivityView("mosaic")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={activityView === "list" ? "default" : "outline"}
                  size="icon"
                  aria-label="Vista lista"
                  title="Vista lista"
                  onClick={() => setActivityView("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={activityView === "details" ? "default" : "outline"}
                  size="icon"
                  aria-label="Vista detallada"
                  title="Vista detallada"
                  onClick={() => setActivityView("details")}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activityLoading ? (
              <div className="py-16 text-center text-muted-foreground">
                Cargando actividad del turno…
              </div>
            ) : !activeShift ? (
              <div className="py-16 text-center">
                <Clock3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No hay un turno abierto para esta sede</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abre un turno desde el POS para consultar y organizar la actividad.
                </p>
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {tableOrders.length === 0
                  ? "Aún no hay órdenes para esta mesa en el turno actual."
                  : "No hay órdenes que coincidan con los filtros seleccionados."}
              </div>
            ) : activityView === "mosaic" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">Orden #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(order.createdAt)} · {order.customerName || "Cliente sin nombre"}
                          </p>
                        </div>
                        <Badge variant={order.status === "CANCELLED" ? "destructive" : "secondary"}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {order.items.slice(0, 3).map((item) => (
                          <p key={item.id} className="truncate text-sm">
                            {item.quantity} × {item.product.name}
                          </p>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            y {order.items.length - 3} productos más
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between border-t pt-3">
                        <div className="text-xs text-muted-foreground">
                          <p>{order.isPaid ? "Pagada" : "Pendiente de pago"}</p>
                          <p>Cuenta: {getAccountDuration(order)}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(getOrderTotal(order))}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activityView === "list" ? (
              <div className="space-y-2">
                {visibleOrders.map((order) => (
                  <div key={order.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">#{order.id.slice(0, 8)}</span>
                        <Badge variant={order.status === "CANCELLED" ? "destructive" : "secondary"}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {order.customerName || "Cliente sin nombre"} · {order.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ")}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>{order.isPaid ? "Pagada" : "Pendiente"}</p>
                      <p>Cuenta: {getAccountDuration(order)}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(getOrderTotal(order))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-wrap items-start justify-between gap-3 bg-muted p-4">
                        <div>
                          <p className="font-semibold">Orden #{order.id}</p>
                          <p className="text-sm text-muted-foreground">
                            Creada {formatDateTime(order.createdAt)}
                            {order.user && ` · Atendió ${order.user.firstName} ${order.user.lastName}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.customerName || "Cliente sin nombre"} · Cuenta en mesa: {getAccountDuration(order)}
                          </p>
                          {order.tableAccountSession && (
                            <p className="text-sm text-muted-foreground">
                              Cuenta cerrada · {order.tableAccountSession.orderCount} órdenes · Total {formatCurrency(order.tableAccountSession.total)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={order.status === "CANCELLED" ? "destructive" : "secondary"}>
                            {ORDER_STATUS_LABELS[order.status] ?? order.status}
                          </Badge>
                          <Badge variant={order.isPaid ? "default" : "outline"}>
                            {order.isPaid ? "Pagada" : "Pendiente de pago"}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3 p-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                            <div>
                              <p className="font-medium">{item.quantity} × {item.product.name}</p>
                              {item.variants.map((variant) => (
                                <p key={`${item.id}-${variant.productVariant.name}`} className="text-sm text-muted-foreground">
                                  {variant.groupName ? `${variant.groupName}: ` : ""}{variant.productVariant.name}
                                </p>
                              ))}
                              <p className="text-xs text-muted-foreground">
                                Estado del producto: {ORDER_STATUS_LABELS[item.status] ?? item.status}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-medium">
                              {formatCurrency((item.price ?? item.product.price) * item.quantity)}
                            </p>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <div className="text-sm text-muted-foreground">
                            {order.payments.length > 0
                              ? order.payments.map((payment) => (
                                  <span key={payment.id} className="mr-3">
                                    {payment.method} · {payment.status} · {formatCurrency(payment.amount)}
                                  </span>
                                ))
                              : order.paymentMethod ?? "Sin pago registrado"}
                          </div>
                          <p className="text-lg font-bold">{formatCurrency(getOrderTotal(order))}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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