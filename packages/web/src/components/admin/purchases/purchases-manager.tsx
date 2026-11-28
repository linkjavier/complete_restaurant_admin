"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Sparkles, Trash2 } from "lucide-react"
import {
  getPurchases,
  createPurchase,
  getIngredients,
  getSuppliers,
  getIngredientCategories,
  Purchase,
  Ingredient,
  IngredientCategory,
  Supplier,
} from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { ALL_LOCATIONS, useLocationSelection } from "@/hooks/use-location-selection"
import { PurchaseAssistantDialog, PurchaseAssistantDraft } from "./purchase-assistant-dialog"

interface PurchaseLine {
  id: string
  ingredientId: string
  quantity: number
  unitCost: number
  detectedName?: string
}

const createNewLine = (): PurchaseLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  ingredientId: "",
  quantity: 0,
  unitCost: 0,
})

export function PurchasesManager() {
  const { locations, selectedLocationId, isLoadingLocations } = useLocationSelection()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredientCategories, setIngredientCategories] = useState<IngredientCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([createNewLine()])
  const requestId = useRef(0)
  const { toast } = useToast()

  const totalCost = useMemo(
    () => purchaseLines.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    [purchaseLines],
  )
  const availableIngredients = useMemo(
    () => selectedLocationId !== ALL_LOCATIONS
      ? ingredients.filter((ingredient) => ingredient.locationId === selectedLocationId)
      : ingredients,
    [ingredients, selectedLocationId],
  )

  const fetchData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const [purchaseData, ingredientsData, supplierData, categoryData] = await Promise.all([
        getPurchases(
          selectedLocationId !== ALL_LOCATIONS
            ? { locationId: selectedLocationId }
            : undefined,
        ),
        getIngredients(),
        getSuppliers(),
        getIngredientCategories(),
      ])
      if (currentRequest !== requestId.current) return
      setPurchases(purchaseData)
      setIngredients(ingredientsData)
      setSuppliers(supplierData)
      setIngredientCategories(categoryData)
    } catch (err) {
      if (currentRequest !== requestId.current) return
      console.error('Error fetching purchases data:', err)
      const errorMessage = err instanceof Error
        ? err.message
        : 'Error al cargar los datos de compras. Por favor, asegúrate de estar autenticado.'
      setError(errorMessage)
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [selectedLocationId])

  useEffect(() => {
    setIsAssistantOpen(false)
  }, [selectedLocationId])

  useEffect(() => {
    if (!isLoadingLocations) {
      void fetchData()
    }
  }, [fetchData, isLoadingLocations])

  useEffect(() => {
    if (selectedLocationId === ALL_LOCATIONS) return

    setPurchaseLines((current) => current.map((line) => {
      const selectedIngredient = ingredients.find(
        (ingredient) => ingredient.id === line.ingredientId,
      )
      return selectedIngredient && selectedIngredient.locationId !== selectedLocationId
        ? { ...line, ingredientId: '' }
        : line
    }))
  }, [ingredients, selectedLocationId])

  const handleAddLine = () => {
    setPurchaseLines((current) => [...current, createNewLine()])
  }

  const handleRemoveLine = (id: string) => {
    setPurchaseLines((current) => current.filter((line) => line.id !== id))
  }

  const updateLine = (
    id: string,
    field: keyof Omit<PurchaseLine, 'id' | 'detectedName'>,
    value: string | number,
  ) => {
    setPurchaseLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: typeof value === 'string' && field !== 'ingredientId' ? Number(value) : value,
            }
          : line,
      ),
    )
  }

  const handleOpenAssistant = () => {
    if (selectedLocationId === ALL_LOCATIONS) {
      toast({
        title: 'Selecciona una ubicación',
        description: 'Selecciona una ubicación específica en la barra superior antes de usar el asistente.',
        variant: 'destructive',
      })
      return
    }

    setIsAssistantOpen(true)
  }

  const handleUseExtraction = (draft: PurchaseAssistantDraft) => {
    setSupplierId(draft.supplierId)
    if (draft.purchaseDate) setPurchaseDate(draft.purchaseDate)
    setPurchaseLines(draft.items.map((item) => ({
      id: createNewLine().id,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      detectedName: item.detectedName,
    })))
    toast({
      title: 'Borrador de compra listo',
      description: 'Revisa los datos detectados y asigna los ingredientes que no se reconocieron.',
    })
  }

  const handleCreatePurchase = async () => {
    if (!supplierId || !purchaseDate || selectedLocationId === ALL_LOCATIONS) {
      toast({
        title: 'Error',
        description: selectedLocationId === ALL_LOCATIONS
          ? 'Selecciona una ubicación específica en la barra superior.'
          : 'Por favor completa todos los campos requeridos.',
        variant: 'destructive',
      })
      return
    }

    if (purchaseLines.some(
      (line) =>
        !line.ingredientId || !Number.isFinite(line.quantity) || line.quantity <= 0 ||
        !Number.isFinite(line.unitCost) || line.unitCost < 0,
    )) {
      toast({
        title: 'Revisa las líneas de compra',
        description: 'Asigna un ingrediente y revisa la cantidad y el costo de cada línea antes de registrar la compra.',
        variant: 'destructive',
      })
      return
    }

    const validLines = purchaseLines.filter((line) => line.ingredientId && line.quantity > 0)
    if (validLines.length === 0) {
      toast({
        title: 'Error',
        description: 'Agrega al menos un ingrediente con cantidad válida.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await createPurchase({
        supplierId,
        purchaseDate,
        locationId: selectedLocationId,
        totalCost: totalCost > 0 ? totalCost : undefined,
        items: validLines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      })
      toast({
        title: 'Éxito',
        description: 'Compra registrada correctamente.',
      })
      setSupplierId('')
      setPurchaseLines([createNewLine()])
      void fetchData()
    } catch (err) {
      console.error('Error creating purchase:', err)
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo registrar la compra. Revisa los datos e inténtalo de nuevo.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Registrar Compra</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenAssistant}
            disabled={loading || saving || !!error}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Asistente de compras
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Ubicación de la compra: </span>
              {selectedLocationId === ALL_LOCATIONS
                ? 'Selecciona una ubicación específica en la barra superior.'
                : locations.find((location) => location.id === selectedLocationId)?.name
                  ?? 'Se usará la ubicación seleccionada en la barra superior.'}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="purchaseSupplier">Proveedor</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="purchaseSupplier">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((supplier) => supplier.isActive).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link href="/admin/suppliers" className="text-sm text-primary underline">
                  Administrar o crear proveedores
                </Link>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="purchaseDate">Fecha de Compra</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="grid gap-2">
                <Label>Total Estimado</Label>
                <Input value={`${totalCost.toFixed(2)}`} readOnly />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Líneas de compra</p>
                  <p className="text-sm text-muted-foreground">Cada línea equivale a un ingrediente comprado.</p>
                </div>
                <Button type="button" onClick={handleAddLine}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar línea
                </Button>
              </div>

              <div className="space-y-4">
                {purchaseLines.map((line) => (
                  <div key={line.id} className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1.5fr_1fr_1fr_auto]">
                    <div className="grid gap-2">
                      <Label>Ingrediente</Label>
                      <Select value={line.ingredientId} onValueChange={(value) => updateLine(line.id, 'ingredientId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableIngredients.map((ingredient) => (
                            <SelectItem key={ingredient.id} value={ingredient.id}>
                              {ingredient.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {line.detectedName && (
                        <p className="text-xs text-muted-foreground">
                          Detectado por IA: {line.detectedName}
                          {!line.ingredientId && ' · selecciona el ingrediente correspondiente'}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.quantity}
                        onChange={(event) => updateLine(line.id, 'quantity', event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Precio Unitario</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unitCost}
                        onChange={(event) => updateLine(line.id, 'unitCost', event.target.value)}
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveLine(line.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleCreatePurchase}
                  disabled={loading || !!error || saving || selectedLocationId === ALL_LOCATIONS}
                >
                  {saving ? 'Guardando...' : 'Registrar Compra'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PurchaseAssistantDialog
        key={selectedLocationId}
        isOpen={isAssistantOpen}
        locationId={selectedLocationId === ALL_LOCATIONS ? "" : selectedLocationId}
        suppliers={suppliers}
        ingredients={ingredients}
        categories={ingredientCategories}
        onClose={() => setIsAssistantOpen(false)}
        onUseExtraction={handleUseExtraction}
        onSupplierCreated={(supplier) => setSuppliers((current) => [...current, supplier])}
        onIngredientCreated={(ingredient) => setIngredients((current) => [...current, ingredient])}
        onCategoryCreated={(category) => setIngredientCategories((current) => [...current, category])}
      />

      <Card>
        <CardHeader>
          <CardTitle>Compras Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground">Cargando compras...</div>
          ) : error ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <p className="font-semibold">Error al cargar las compras</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
              <div className="flex justify-center">
                <Button onClick={fetchData} variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <p>No hay compras registradas.</p>
              <p className="text-sm">Comienza a registrar compras de inventario usando el formulario anterior.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{purchase.supplierName}</p>
                      <p className="text-sm text-muted-foreground">{purchase.location?.name || purchase.locationId}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(purchase.purchaseDate).toLocaleDateString()} · Total: {purchase.totalCost?.toFixed(2) ?? '0.00'}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {purchase.items?.map((item) => (
                      <div key={item.id} className="rounded-lg border bg-muted p-3">
                        <p className="font-medium">{item.ingredient?.name || item.ingredientId}</p>
                        <p className="text-sm text-muted-foreground">Cantidad: {item.quantity}</p>
                        <p className="text-sm text-muted-foreground">Costo unitario: {item.unitCost.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
