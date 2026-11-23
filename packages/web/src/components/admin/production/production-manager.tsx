"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getLocations,
  getProducts,
  getProductionHistory,
  Location,
  Product,
  ProductionLog,
  produceProduct,
} from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Minus,
  Plus,
  PackageCheck,
  Printer,
  ScrollText,
  UserRound,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  downloadProductionPdf,
  printProduction,
} from "@/components/admin/production/production-report"

const ALL_LOCATIONS = "all"
const HISTORY_PAGE_SIZE = 4

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(quantity)
}

function formatProductionNumber(number: number) {
  return `PRO-${String(number).padStart(6, "0")}`
}

function productionActorName(entry: ProductionLog) {
  if (!entry.createdBy) return "Responsable no registrado"
  return `${entry.createdBy.firstName} ${entry.createdBy.lastName}`.trim() || entry.createdBy.email
}

function formatProductionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function QuantityStepper({
  id,
  label,
  unit,
  value,
  min,
  onChange,
}: {
  id: string
  label: string
  unit: string
  value: number
  min: number
  onChange: (value: number) => void
}) {
  const update = (nextValue: number) => {
    const rounded = Number.isFinite(nextValue)
      ? Math.round(nextValue * 1000) / 1000
      : min
    onChange(Math.max(min, rounded))
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-slate-200">
        {label} ({unit})
      </Label>
      <div className="flex h-10 overflow-hidden rounded-lg border border-slate-600 bg-[#0b1220] shadow-inner shadow-black/20 focus-within:ring-2 focus-within:ring-emerald-500/40">
        <Input
          id={id}
          type="number"
          min={min}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent text-slate-100 shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Disminuir ${label.toLocaleLowerCase()}`}
          className="h-full w-10 shrink-0 rounded-none border-l border-slate-700 text-slate-300 hover:bg-slate-700/70 hover:text-white"
          onClick={() => update(value - (value % 1 === 0 ? 1 : 0.1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Aumentar ${label.toLocaleLowerCase()}`}
          className="h-full w-10 shrink-0 rounded-none border-l border-slate-700 text-slate-300 hover:bg-slate-700/70 hover:text-white"
          onClick={() => update(value + (value % 1 === 0 ? 1 : 0.1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function ProductionManager() {
  const { toast } = useToast()
  const { user, isLoading: isAuthLoading } = useAuth()
  const isSuperAdmin = user?.role === "SUPER_ADMIN"
  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [history, setHistory] = useState<ProductionLog[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_LOCATIONS)
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [wasteQuantity, setWasteQuantity] = useState(0)
  const [wasteNotes, setWasteNotes] = useState("")
  const [historyPage, setHistoryPage] = useState(1)
  const [detailsEntry, setDetailsEntry] = useState<ProductionLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeLocationId = isSuperAdmin
    ? selectedLocationId === ALL_LOCATIONS
      ? undefined
      : selectedLocationId
    : user?.locationId ?? undefined

  const loadData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      if (!isSuperAdmin && !user.locationId) {
        throw new Error("Tu usuario no tiene una sucursal asignada.")
      }

      const [productData, historyData, locationData] = await Promise.all([
        getProducts(activeLocationId),
        getProductionHistory(activeLocationId),
        isSuperAdmin ? getLocations() : Promise.resolve([]),
      ])
      const producibleProducts = productData.filter(
        (product) =>
          product.isActive &&
          product.isIntermediate &&
          ((product.ingredients?.length ?? 0) > 0 ||
            (product.components?.length ?? 0) > 0),
      )

      setProducts(producibleProducts)
      setHistory(historyData)
      setLocations(locationData)
      setProductId((current) =>
        producibleProducts.some((product) => product.id === current)
          ? current
          : producibleProducts[0]?.id ?? "",
      )
    } catch (loadError) {
      console.error("Error loading production data:", loadError)
      const message =
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los datos de producción."
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [activeLocationId, isSuperAdmin, toast, user])

  useEffect(() => {
    if (!isAuthLoading && user) void loadData()
  }, [isAuthLoading, loadData, user])

  const selectedProduct = products.find((product) => product.id === productId)
  const batchQuantity = quantity + wasteQuantity
  const requiredIngredients = useMemo(
    () =>
      (selectedProduct?.ingredients ?? []).map((recipeLine) => ({
        ...recipeLine,
        required: recipeLine.quantity * batchQuantity,
      })),
    [batchQuantity, selectedProduct],
  )
  const requiredProducts = useMemo(
    () =>
      (selectedProduct?.components ?? []).map((recipeLine) => ({
        ...recipeLine,
        required: recipeLine.quantity * batchQuantity,
      })),
    [batchQuantity, selectedProduct],
  )
  const requiredMaterials = useMemo(
    () => [
      ...requiredIngredients.map((line) => ({
        id: `ingredient-${line.ingredientId}`,
        name: line.ingredient?.name ?? "Ingrediente",
        unit: line.ingredient?.unit ?? "",
        required: line.required,
        available: line.ingredient?.quantity ?? 0,
        kind: "Ingrediente",
      })),
      ...requiredProducts.map((line) => ({
        id: `product-${line.componentId}`,
        name: line.component?.name ?? "Preparación",
        unit: line.component?.unit ?? "",
        required: line.required,
        available: line.component?.quantity ?? 0,
        kind: "Preparación",
      })),
    ],
    [requiredIngredients, requiredProducts],
  )
  const hasInsufficientMaterials = requiredMaterials.some(
    (material) => material.available < material.required,
  )
  const historyPageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const paginatedHistory = history.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  )

  useEffect(() => {
    setHistoryPage(1)
  }, [selectedLocationId])

  const handleReport = (entry: ProductionLog, action: "download" | "print") => {
    try {
      if (action === "download") downloadProductionPdf(entry)
      else printProduction(entry)
    } catch (reportError) {
      console.error("Error generating production report:", reportError)
      toast({
        title: action === "download" ? "No se pudo descargar el PDF" : "No se pudo imprimir",
        description:
          reportError instanceof Error
            ? reportError.message
            : "Intenta de nuevo.",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async () => {
    if (!selectedProduct || !Number.isFinite(quantity) || quantity <= 0) {
      toast({
        title: "Revisa la producción",
        description: "Selecciona una preparación e indica una cantidad mayor que cero.",
        variant: "destructive",
      })
      return
    }
    if (!Number.isFinite(wasteQuantity) || wasteQuantity < 0) {
      toast({
        title: "Revisa la merma",
        description: "La merma debe ser un valor igual o mayor que cero.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      await produceProduct({
        productId: selectedProduct.id,
        quantity,
        wasteQuantity: wasteQuantity || undefined,
        wasteNotes: wasteNotes.trim() || undefined,
      })
      toast({
        title: "Producción registrada",
        description: `${formatQuantity(quantity)} ${selectedProduct.unit} de ${selectedProduct.name} agregados al inventario.`,
      })
      setWasteQuantity(0)
      setWasteNotes("")
      await loadData()
    } catch (submitError) {
      console.error("Error recording production:", submitError)
      toast({
        title: "No se pudo registrar la producción",
        description:
          submitError instanceof Error
            ? submitError.message
            : "Ocurrió un error inesperado al registrar la producción.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (isAuthLoading || loading) {
    return <p className="text-muted-foreground">Cargando datos de producción...</p>
  }

  return (
    <div className="min-w-0 space-y-5 rounded-2xl bg-[#0a101b] p-3 text-slate-100 sm:space-y-6 sm:p-5 lg:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Producción</h1>
        <p className="text-sm text-slate-400">
          Prepara productos por lote, controla la merma y revisa el inventario utilizado.
        </p>
      </header>

      {isSuperAdmin && (
        <section className="space-y-2">
          <Label className="text-xs font-medium text-slate-300">Sucursal</Label>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-700 bg-[#101827] p-1 shadow-inner shadow-black/20">
            {[{ id: ALL_LOCATIONS, name: "Todas las sucursales" }, ...locations].map((location) => (
              <button
                key={location.id}
                type="button"
                aria-pressed={selectedLocationId === location.id}
                onClick={() => setSelectedLocationId(location.id)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${
                  selectedLocationId === location.id
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                {location.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className="flex flex-col items-stretch justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center">
          <span>{error}</span>
          <Button variant="outline" size="sm" className="w-full border-rose-400/40 bg-transparent text-rose-100 hover:bg-rose-500/20 sm:w-auto" onClick={() => void loadData()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(330px,0.95fr)]">
        <Card className="min-w-0 overflow-hidden rounded-xl border border-slate-700/80 bg-[#101827] text-slate-100 shadow-xl shadow-black/20">
          <CardHeader className="space-y-2 border-b border-slate-700/70 p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Boxes className="h-4 w-4 text-slate-300" />
              Registrar producción
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed text-slate-400">
              Gestiona tus preparaciones, descuenta los ingredientes y productos preelaborados de la receta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            {products.length === 0 ? (
              <div className="space-y-3 rounded-lg border border-dashed border-slate-600 bg-slate-900/50 p-4 sm:p-5">
                <p className="font-medium text-slate-100">Todavía no hay preparaciones listas para producir.</p>
                <p className="text-sm text-slate-400">
                  Crea una preparación intermedia y agrega al menos un ingrediente o producto preelaborado a su receta.
                </p>
                <Button asChild variant="outline" className="w-full border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 sm:w-auto">
                  <Link href="/admin/products">Configurar productos y recetas</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="production-product" className="text-xs font-medium text-slate-200">
                    Preparación a producir
                  </Label>
                  <button
                    type="button"
                    onClick={() => document.getElementById("production-materials")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-emerald-300"
                  >
                    <ScrollText className="h-3.5 w-3.5" />
                    Recetas relacionadas
                  </button>
                </div>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="production-product" className="h-10 min-w-0 border-slate-600 bg-[#0b1220] text-slate-100 shadow-sm focus:ring-emerald-500/40">
                    <SelectValue placeholder="Selecciona una preparación" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} · stock {formatQuantity(product.quantity)} {product.unit}
                        {isSuperAdmin && selectedLocationId === ALL_LOCATIONS
                          ? ` · ${product.location?.name ?? "Sucursal"}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedProduct && (
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/70 p-3 sm:p-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-100">{selectedProduct.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Inventario actual: {formatQuantity(selectedProduct.quantity)} {selectedProduct.unit}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">Código: {selectedProduct.code}</p>
                    </div>
                    {selectedProduct.location?.name && (
                      <Badge variant="outline" className="border-slate-600 bg-slate-900/70 text-xs text-slate-300">
                        {selectedProduct.location.name}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <QuantityStepper
                    id="production-quantity"
                    label="Cantidad buena"
                    unit={selectedProduct?.unit || "unidad"}
                    value={quantity}
                    min={0.0001}
                    onChange={setQuantity}
                  />
                  <QuantityStepper
                    id="production-waste"
                    label="Merma"
                    unit={selectedProduct?.unit || "unidad"}
                    value={wasteQuantity}
                    min={0}
                    onChange={setWasteQuantity}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="production-waste-notes" className="text-xs font-medium text-slate-200">
                    Notas de merma (opcional)
                  </Label>
                  <Textarea
                    id="production-waste-notes"
                    placeholder="Ej: recorte, derrame o producto dañado"
                    value={wasteNotes}
                    onChange={(event) => setWasteNotes(event.target.value)}
                    className="min-h-16 border-slate-600 bg-[#0b1220] text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500/40"
                  />
                </div>

                <div
                  id="production-materials"
                  className={`min-w-0 space-y-3 rounded-lg border p-3 shadow-lg sm:p-4 ${
                    hasInsufficientMaterials
                      ? "border-amber-400/50 bg-amber-500/[0.09] shadow-amber-950/10"
                      : "border-emerald-500/30 bg-emerald-500/[0.06] shadow-emerald-950/10"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Insumos necesarios</p>
                    <p className="text-xs text-slate-400">
                      Cálculo para {formatQuantity(batchQuantity)} {selectedProduct?.unit} (incluye la merma).
                    </p>
                  </div>
                  {requiredMaterials.map((material) => {
                    const enough = material.available >= material.required
                    const progress = material.required > 0
                      ? Math.min((material.available / material.required) * 100, 100)
                      : 100
                    return (
                      <div key={material.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_84px] items-center gap-x-3 gap-y-1.5 text-xs sm:grid-cols-[minmax(0,1fr)_90px]">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">
                            {material.name}
                            <span className="ml-1 font-normal text-slate-400">
                              · {formatQuantity(material.required)} {material.unit}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {material.kind} · disponible: {formatQuantity(material.available)} {material.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className={`h-full rounded-full transition-all ${enough ? "bg-emerald-400" : "bg-rose-400"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {enough
                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
                        </div>
                      </div>
                    )
                  })}
                  {!requiredMaterials.length && (
                    <p className="text-xs text-slate-400">La receta no tiene insumos configurados.</p>
                  )}
                  {!!requiredMaterials.length && (
                    <div className="flex items-start gap-2 border-t border-slate-600/70 pt-3 text-xs text-slate-300">
                      <AlertCircle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${hasInsufficientMaterials ? "text-amber-300" : "text-emerald-300"}`} />
                      {hasInsufficientMaterials
                        ? "Hay insumos insuficientes. Ajusta la cantidad o repón existencias para poder registrar."
                        : "Hay existencias suficientes. El inventario se descontará al registrar la producción."}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={submitting || !selectedProduct || quantity <= 0 || hasInsufficientMaterials}
                    className="min-h-10 w-full bg-slate-100 font-semibold text-slate-950 shadow-md shadow-black/20 hover:bg-white disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    {submitting ? "Registrando lote..." : "Registrar producción"}
                  </Button>
                  <p className="text-center text-[11px] text-slate-500 sm:text-right">
                    Se generará el consecutivo y quedará el responsable registrado.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-xl border border-slate-700/80 bg-[#101827] text-slate-100 shadow-xl shadow-black/20">
          <CardHeader className="space-y-2 border-b border-slate-700/70 p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Clock3 className="h-4 w-4 text-slate-300" />
              Producciones recientes
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Últimos 100 registros de la sucursal seleccionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-5 text-center">
                <ClipboardList className="mx-auto mb-2 h-6 w-6 text-slate-500" />
                <p className="text-sm text-slate-300">Aún no hay lotes registrados.</p>
                <p className="mt-1 text-xs text-slate-500">Tus producciones aparecerán aquí con su trazabilidad.</p>
              </div>
            ) : (
              <>
                <div className="relative space-y-2.5 before:absolute before:bottom-5 before:left-[9px] before:top-5 before:w-px before:bg-slate-700">
                  {paginatedHistory.map((entry) => (
                    <article
                      key={entry.id}
                      className="relative ml-5 min-w-0 rounded-lg border border-slate-700 bg-[#0c1421] p-3 shadow-md shadow-black/20 transition-colors hover:border-slate-600"
                    >
                      <span className="absolute -left-[26px] top-4 h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-[#101827] ring-4 ring-[#101827]" />
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate text-xs font-semibold text-white">
                              {entry.productName ?? entry.product.name}
                            </h3>
                            <Badge variant="outline" className="h-5 border-slate-600 px-1.5 font-mono text-[9px] text-slate-300">
                              {formatProductionNumber(entry.number)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">{formatProductionDate(entry.createdAt)}</p>
                        </div>
                        <Badge className={`shrink-0 border-0 px-2 text-[10px] ${
                          entry.wasteQuantity > 0
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}>
                          +{formatQuantity(entry.quantity)} {entry.productUnit ?? entry.product.unit}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] text-slate-400">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <UserRound className="h-3 w-3 shrink-0" />
                          <span className="truncate">{productionActorName(entry)}</span>
                        </p>
                        <p className="truncate">Código: {entry.productCode ?? entry.product.code}</p>
                        {entry.wasteQuantity > 0 && (
                          <p className="text-amber-300">
                            Merma: {formatQuantity(entry.wasteQuantity)} {entry.productUnit ?? entry.product.unit}
                            {entry.wasteNotes ? ` · ${entry.wasteNotes}` : ""}
                          </p>
                        )}
                        {isSuperAdmin && selectedLocationId === ALL_LOCATIONS && (
                          <p className="truncate">{entry.product.location?.name ?? "Sucursal"}</p>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/70 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => setDetailsEntry(entry)}
                        >
                          <FileText className="mr-1 h-3 w-3" />
                          Ver detalles del lote
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white"
                            aria-label={`Descargar PDF de ${formatProductionNumber(entry.number)}`}
                            title="Descargar PDF"
                            onClick={() => handleReport(entry, "download")}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white"
                            aria-label={`Imprimir lote ${formatProductionNumber(entry.number)}`}
                            title="Imprimir lote"
                            onClick={() => handleReport(entry, "print")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {historyPageCount > 1 && (
                  <nav aria-label="Paginación del historial de producción" className="mt-4 flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Página anterior"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                      className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: historyPageCount }, (_, index) => index + 1)
                      .filter((page) => page === 1 || page === historyPageCount || Math.abs(page - historyPage) <= 1)
                      .map((page, index, pages) => (
                        <span key={page} className="contents">
                          {index > 0 && pages[index - 1] !== page - 1 && (
                            <span className="px-1 text-xs text-slate-500">…</span>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant={historyPage === page ? "secondary" : "ghost"}
                            aria-label={`Página ${page}`}
                            aria-current={historyPage === page ? "page" : undefined}
                            onClick={() => setHistoryPage(page)}
                            className="h-8 w-8 text-xs text-slate-200"
                          >
                            {page}
                          </Button>
                        </span>
                      ))}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Página siguiente"
                      disabled={historyPage === historyPageCount}
                      onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                      className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailsEntry} onOpenChange={(open) => !open && setDetailsEntry(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto border-slate-700 bg-[#101827] text-slate-100 sm:max-w-xl">
          {detailsEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">
                  Detalle del lote {formatProductionNumber(detailsEntry.number)}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {detailsEntry.productName ?? detailsEntry.product.name} · {formatProductionDate(detailsEntry.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-400">Responsable</p>
                  <p className="mt-1">{productionActorName(detailsEntry)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-400">Producto</p>
                  <p className="mt-1">{detailsEntry.productCode ?? detailsEntry.product.code}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-400">Cantidad buena</p>
                  <p className="mt-1">+{formatQuantity(detailsEntry.quantity)} {detailsEntry.productUnit ?? detailsEntry.product.unit}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-400">Merma</p>
                  <p className="mt-1">{formatQuantity(detailsEntry.wasteQuantity)} {detailsEntry.productUnit ?? detailsEntry.product.unit}</p>
                </div>
              </div>
              {detailsEntry.wasteNotes && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <p className="text-xs font-medium text-amber-200">Notas de merma</p>
                  <p className="mt-1 text-slate-200">{detailsEntry.wasteNotes}</p>
                </div>
              )}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Insumos consumidos</h3>
                {detailsEntry.consumedMaterials.length ? (
                  detailsEntry.consumedMaterials.map((material, index) => (
                    <div key={`${material.type}-${material.id}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{material.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{material.code} · {material.type === "INGREDIENT" ? "Ingrediente" : "Preparación"}</p>
                      </div>
                      <p className="shrink-0 text-slate-300">{formatQuantity(material.quantity)} {material.unit}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                    Este registro histórico no conserva el detalle de insumos.
                  </p>
                )}
              </section>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800"
                  onClick={() => handleReport(detailsEntry, "download")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
                <Button
                  type="button"
                  className="bg-slate-100 text-slate-950 hover:bg-white"
                  onClick={() => handleReport(detailsEntry, "print")}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir lote
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
