"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { getPurchases, createPurchase, getIngredients, getLocations, Purchase, Ingredient, Location } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

interface PurchaseLine {
  id: string
  ingredientId: string
  quantity: number
  unitCost: number
}

const createNewLine = (): PurchaseLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  ingredientId: "",
  quantity: 0,
  unitCost: 0,
})

export function PurchasesManager() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supplierName, setSupplierName] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [locationId, setLocationId] = useState("")
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([createNewLine()])
  const { toast } = useToast()

  const totalCost = useMemo(
    () => purchaseLines.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    [purchaseLines],
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [purchaseData, ingredientsData, locationsData] = await Promise.all([
        getPurchases(),
        getIngredients(),
        getLocations(),
      ])
      setPurchases(purchaseData)
      setIngredients(ingredientsData)
      setLocations(locationsData)
    } catch (err) {
      console.error('Error fetching purchases data:', err)
      const errorMessage = err instanceof Error
        ? err.message
        : 'Error al cargar los datos de compras. Por favor, asegúrate de estar autenticado.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLine = () => {
    setPurchaseLines((current) => [...current, createNewLine()])
  }

  const handleRemoveLine = (id: string) => {
    setPurchaseLines((current) => current.filter((line) => line.id !== id))
  }

  const updateLine = (id: string, field: keyof Omit<PurchaseLine, 'id'>, value: string | number) => {
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

  const handleCreatePurchase = async () => {
    if (!supplierName.trim() || !purchaseDate || !locationId) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
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
        supplierName,
        purchaseDate,
        locationId,
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
      setSupplierName('')
      setLocationId('')
      setPurchaseLines([createNewLine()])
      fetchData()
    } catch (err) {
      console.error('Error creating purchase:', err)
      toast({
        title: 'Error',
        description: 'No se pudo registrar la compra. Revisa los datos e inténtalo de nuevo.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registrar Compra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="supplierName">Proveedor</Label>
                <Input
                  id="supplierName"
                  placeholder="Nombre del proveedor"
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                />
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

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="locationId">Ubicación</Label>
                <Select value={locationId} onValueChange={(value) => setLocationId(value)}>
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
                {purchaseLines.map((line, index) => (
                  <div key={line.id} className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1.5fr_1fr_1fr_auto]">
                    <div className="grid gap-2">
                      <Label>Ingrediente</Label>
                      <Select value={line.ingredientId} onValueChange={(value) => updateLine(line.id, 'ingredientId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ingredient) => (
                            <SelectItem key={ingredient.id} value={ingredient.id}>
                              {ingredient.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                <Button onClick={handleCreatePurchase} disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar Compra'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
