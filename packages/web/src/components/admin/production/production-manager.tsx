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
  Clock3,
  Download,
  PackageCheck,
  Printer,
  UserRound,
} from "lucide-react"
import {
  downloadProductionPdf,
  printProduction,
} from "@/components/admin/production/production-report"

const ALL_LOCATIONS = "all"

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
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {isSuperAdmin && (
        <div className="w-full space-y-2 sm:max-w-sm">
          <Label htmlFor="production-location">Sucursal</Label>
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger id="production-location">
              <SelectValue placeholder="Selecciona una sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS}>Todas las sucursales</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-stretch justify-between gap-3 rounded-md border border-destructive/40 p-4 text-sm sm:flex-row sm:items-center sm:gap-4">
          <span>{error}</span>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => void loadData()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <Card className="min-w-0">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 shrink-0" />
              Registrar producción
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Produce preparaciones y descuenta automáticamente los ingredientes y productos
              preelaborados de la receta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:space-y-5 sm:p-6 sm:pt-0">
            {products.length === 0 ? (
              <div className="space-y-3 rounded-md border border-dashed p-4 sm:p-5">
                <p className="font-medium">Todavía no hay preparaciones listas para producir.</p>
                <p className="text-sm text-muted-foreground">
                  En Productos, crea una preparación intermedia, define su unidad y agrega al menos
                  un ingrediente o producto preelaborado a la receta.
                </p>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/admin/products">Configurar productos y recetas</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="production-product">Preparación a producir</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger id="production-product" className="min-w-0">
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
                </div>

                {selectedProduct && (
                  <div className="min-w-0 rounded-md bg-muted/40 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Inventario actual: {formatQuantity(selectedProduct.quantity)}{" "}
                          {selectedProduct.unit}
                        </p>
                      </div>
                      {isSuperAdmin && (
                        <Badge variant="outline">
                          {selectedProduct.location?.name ?? "Sucursal"}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="production-quantity">
                      Cantidad buena ({selectedProduct?.unit || "unidad"})
                    </Label>
                    <Input
                      id="production-quantity"
                      type="number"
                      min="0.0001"
                      step="any"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(event.target.value === "" ? 0 : Number(event.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="production-waste">
                      Merma ({selectedProduct?.unit || "unidad"})
                    </Label>
                    <Input
                      id="production-waste"
                      type="number"
                      min="0"
                      step="any"
                      value={wasteQuantity}
                      onChange={(event) =>
                        setWasteQuantity(
                          event.target.value === "" ? 0 : Number(event.target.value),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="production-waste-notes">Notas de merma (opcional)</Label>
                  <Textarea
                    id="production-waste-notes"
                    placeholder="Ej: recorte, derrame o producto dañado"
                    value={wasteNotes}
                    onChange={(event) => setWasteNotes(event.target.value)}
                  />
                </div>

                <div className="min-w-0 space-y-3 rounded-md border p-3 sm:p-4">
                  <div>
                    <p className="font-medium">Insumos que se descontarán</p>
                    <p className="text-sm text-muted-foreground">
                      Cálculo para {formatQuantity(batchQuantity)} {selectedProduct?.unit}{" "}
                      (incluye la merma).
                    </p>
                  </div>
                  {requiredIngredients.map((line) => {
                    const enough = (line.ingredient?.quantity ?? 0) >= line.required
                    return (
                      <div
                        key={line.ingredientId}
                        className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm"
                      >
                        <span className="min-w-0 flex-1 break-words">
                          {line.ingredient?.name ?? "Ingrediente"}
                          <span className="text-muted-foreground">
                            {" "}· disponible {formatQuantity(line.ingredient?.quantity ?? 0)}{" "}
                            {line.ingredient?.unit}
                          </span>
                        </span>
                        <span className={enough ? "shrink-0" : "shrink-0 font-medium text-destructive"}>
                          {formatQuantity(line.required)} {line.ingredient?.unit}
                        </span>
                      </div>
                    )
                  })}
                  {requiredProducts.map((line) => {
                    const enough = (line.component?.quantity ?? 0) >= line.required
                    return (
                      <div
                        key={line.componentId}
                        className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm"
                      >
                        <span className="min-w-0 flex-1 break-words">
                          {line.component?.name ?? "Preparación"}
                          <span className="text-muted-foreground">
                            {" "}· disponible {formatQuantity(line.component?.quantity ?? 0)}{" "}
                            {line.component?.unit}
                          </span>
                        </span>
                        <span className={enough ? "shrink-0" : "shrink-0 font-medium text-destructive"}>
                          {formatQuantity(line.required)} {line.component?.unit}
                        </span>
                      </div>
                    )
                  })}
                  {!requiredIngredients.length && !requiredProducts.length && (
                    <p className="text-sm text-muted-foreground">La receta no tiene insumos.</p>
                  )}
                  {requiredIngredients.length + requiredProducts.length > 0 && (
                    <div className="flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      Si algún insumo no alcanza, la producción completa se cancela sin descontar
                      inventario.
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !selectedProduct || quantity <= 0}
                  className="min-h-11 w-full sm:w-auto"
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  {submitting ? "Registrando..." : "Registrar producción"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 shrink-0" />
              Producciones recientes
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Últimos 100 registros de la sucursal seleccionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay producciones registradas para esta sucursal.
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((entry) => (
                  <div key={entry.id} className="min-w-0 space-y-1 border-b pb-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-medium">
                            {entry.productName ?? entry.product.name}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {formatProductionNumber(entry.number)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString("es-CO")}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <UserRound className="h-3 w-3" />
                          {productionActorName(entry)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Código: {entry.productCode ?? entry.product.code}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge variant="secondary" className="whitespace-nowrap">
                          +{formatQuantity(entry.quantity)} {entry.productUnit ?? entry.product.unit}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label={`Descargar PDF de ${formatProductionNumber(entry.number)}`}
                            title="Descargar PDF"
                            onClick={() => handleReport(entry, "download")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label={`Imprimir ${formatProductionNumber(entry.number)}`}
                            title="Imprimir"
                            onClick={() => handleReport(entry, "print")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {entry.wasteQuantity > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Merma: {formatQuantity(entry.wasteQuantity)} {entry.productUnit ?? entry.product.unit}
                        {entry.wasteNotes ? ` · ${entry.wasteNotes}` : ""}
                      </p>
                    )}
                    {entry.consumedMaterials.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {entry.consumedMaterials.length} insumos registrados
                      </p>
                    )}
                    {isSuperAdmin && selectedLocationId === ALL_LOCATIONS && (
                      <p className="text-xs text-muted-foreground">
                        {entry.product.location?.name ?? "Sucursal"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
