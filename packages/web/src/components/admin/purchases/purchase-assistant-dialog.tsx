"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2, Plus, Sparkles, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  createIngredient,
  createIngredientCategory,
  createSupplier,
  extractPurchaseDocument,
  Ingredient,
  IngredientCategory,
  PurchaseDocumentExtraction,
  Supplier,
} from "@/lib/api"

export interface PurchaseAssistantDraft {
  supplierId: string
  purchaseDate: string | null
  items: Array<{
    ingredientId: string
    quantity: number
    unitCost: number
    detectedName: string
  }>
}

interface PurchaseAssistantDialogProps {
  isOpen: boolean
  locationId: string
  suppliers: Supplier[]
  ingredients: Ingredient[]
  categories: IngredientCategory[]
  onClose: () => void
  onUseExtraction: (draft: PurchaseAssistantDraft) => void
  onSupplierCreated: (supplier: Supplier) => void
  onIngredientCreated: (ingredient: Ingredient) => void
  onCategoryCreated: (category: IngredientCategory) => void
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase()

export function PurchaseAssistantDialog({
  isOpen,
  locationId,
  suppliers,
  ingredients,
  categories,
  onClose,
  onUseExtraction,
  onSupplierCreated,
  onIngredientCreated,
  onCategoryCreated,
}: PurchaseAssistantDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [extraction, setExtraction] = useState<PurchaseDocumentExtraction | null>(null)
  const [loading, setLoading] = useState(false)
  const [knownSuppliers, setKnownSuppliers] = useState(suppliers)
  const [knownIngredients, setKnownIngredients] = useState(ingredients)
  const [knownCategories, setKnownCategories] = useState(categories)
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Record<number, string>>({})
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [supplierName, setSupplierName] = useState("")
  const [supplierTaxId, setSupplierTaxId] = useState("")
  const [supplierContactName, setSupplierContactName] = useState("")
  const [supplierEmail, setSupplierEmail] = useState("")
  const [supplierPhone, setSupplierPhone] = useState("")
  const [creatingIngredientIndex, setCreatingIngredientIndex] = useState<number | null>(null)
  const [ingredientNames, setIngredientNames] = useState<Record<number, string>>({})
  const [ingredientUnits, setIngredientUnits] = useState<Record<number, string>>({})
  const [ingredientCategoryIds, setIngredientCategoryIds] = useState<Record<number, string>>({})
  const [categoryNames, setCategoryNames] = useState<Record<number, string>>({})
  const { toast } = useToast()

  useEffect(() => setKnownSuppliers(suppliers), [suppliers])
  useEffect(() => setKnownIngredients(ingredients), [ingredients])
  useEffect(() => setKnownCategories(categories), [categories])

  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setExtraction(null)
      setCreatingSupplier(false)
      setCreatingIngredientIndex(null)
    }
  }, [isOpen])

  const initializeMatches = (result: PurchaseDocumentExtraction) => {
    const supplierName = result.supplierName
    const supplier = supplierName
      ? knownSuppliers.find((item) => item.isActive && normalize(item.name) === normalize(supplierName))
      : undefined
    setSelectedSupplierId(supplier?.id ?? "")

    const matches: Record<number, string> = {}
    const names: Record<number, string> = {}
    const units: Record<number, string> = {}
    const categoryIds: Record<number, string> = {}
    result.items.forEach((item, index) => {
      const match = knownIngredients.find(
        (ingredient) =>
          ingredient.locationId === locationId &&
          normalize(ingredient.name) === normalize(item.ingredientName),
      )
      if (match) matches[index] = match.id
      names[index] = item.ingredientName
      units[index] = ""
      const categoryName = item.categoryName
      const category = categoryName
        ? knownCategories.find((entry) => normalize(entry.name) === normalize(categoryName))
        : undefined
      if (category) categoryIds[index] = category.id
    })
    setSelectedIngredientIds(matches)
    setIngredientNames(names)
    setIngredientUnits(units)
    setIngredientCategoryIds(categoryIds)
    setCategoryNames(Object.fromEntries(
      result.items.map((item, index) => [index, item.categoryName || ""]),
    ))
  }

  const handleExtract = async () => {
    if (!file) return

    setLoading(true)
    try {
      const result = await extractPurchaseDocument(file)
      initializeMatches(result)
      setExtraction(result)
    } catch (error) {
      toast({
        title: "No se pudo analizar el documento",
        description: error instanceof Error ? error.message : "Intenta con otro archivo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSupplier = async () => {
    if (!supplierName.trim()) return
    setLoading(true)
    try {
      const supplier = await createSupplier({
        name: supplierName.trim(),
        taxId: supplierTaxId.trim() || undefined,
        contactName: supplierContactName.trim() || undefined,
        email: supplierEmail.trim() || undefined,
        phone: supplierPhone.trim() || undefined,
      })
      setKnownSuppliers((current) => [...current, supplier])
      setSelectedSupplierId(supplier.id)
      onSupplierCreated(supplier)
      setCreatingSupplier(false)
      toast({ title: "Proveedor creado", description: supplier.name })
    } catch (error) {
      toast({
        title: "No se pudo crear el proveedor",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateIngredient = async (index: number) => {
    const name = ingredientNames[index]?.trim()
    const unit = ingredientUnits[index]?.trim()
    if (!name || !unit) return
    setLoading(true)
    try {
      const ingredient = await createIngredient({
        name,
        quantity: 0,
        unit,
        minQuantity: 0,
        locationId,
        categoryId: ingredientCategoryIds[index] || undefined,
      })
      setKnownIngredients((current) => [...current, ingredient])
      setSelectedIngredientIds((current) => ({ ...current, [index]: ingredient.id }))
      onIngredientCreated(ingredient)
      setCreatingIngredientIndex(null)
      toast({ title: "Ingrediente creado", description: ingredient.name })
    } catch (error) {
      toast({
        title: "No se pudo crear el ingrediente",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async (index: number) => {
    const name = categoryNames[index]?.trim()
    if (!name) return
    setLoading(true)
    try {
      const category = await createIngredientCategory({ name })
      setKnownCategories((current) => [...current, category])
      setIngredientCategoryIds((current) => ({ ...current, [index]: category.id }))
      onCategoryCreated(category)
      toast({ title: "Categoría creada", description: category.name })
    } catch (error) {
      toast({
        title: "No se pudo crear la categoría",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUseExtraction = () => {
    if (!extraction) return
    if (!selectedSupplierId) {
      toast({
        title: "Selecciona un proveedor",
        description: "Elige un proveedor existente o créalo aquí antes de continuar.",
        variant: "destructive",
      })
      return
    }
    const unresolvedIndex = extraction.items.findIndex((_, index) => !selectedIngredientIds[index])
    if (unresolvedIndex !== -1) {
      toast({
        title: "Faltan ingredientes por asignar",
        description: "Selecciona un ingrediente o créalo para cada línea de la compra.",
        variant: "destructive",
      })
      return
    }

    onUseExtraction({
      supplierId: selectedSupplierId,
      purchaseDate: extraction.purchaseDate,
      items: extraction.items.map((item, index) => ({
        ingredientId: selectedIngredientIds[index],
        quantity: item.quantity,
        unitCost: item.unitCost,
        detectedName: item.ingredientName,
      })),
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-[760px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Asistente de compras</DialogTitle>
          <DialogDescription>
            Sube una factura o recibo. Revisa los datos extraídos y crea aquí mismo los proveedores, ingredientes o categorías que falten.
            Los registros creados se guardan inmediatamente; la compra se registra después de revisarla.
          </DialogDescription>
        </DialogHeader>

        {!extraction ? (
          <div className="flex min-h-0 flex-col items-center gap-4 overflow-y-auto rounded-lg border-2 border-dashed p-8 text-center">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <Label htmlFor="purchase-document">Documento de compra</Label>
              <p className="text-sm text-muted-foreground">
                PDF, imagen, Excel, Word o CSV. Máximo 10 MB.
              </p>
            </div>
            <Input
              id="purchase-document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.xlsx,.xls,.docx,.doc,.csv,image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file && (
              <Button onClick={handleExtract} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizando documento...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extraer datos con IA
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto" tabIndex={0} aria-label="Datos extraídos de la compra">
            <div className="space-y-4 pr-4">
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Proveedor</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {knownSuppliers.filter((supplier) => supplier.isActive).map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => {
                      setSupplierName(extraction.supplierName || "")
                      setSupplierTaxId("")
                      setSupplierContactName("")
                      setSupplierEmail("")
                      setSupplierPhone("")
                      setCreatingSupplier((current) => !current)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Crear proveedor
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha detectada</p>
                  <p className="font-medium">{extraction.purchaseDate || "No detectada"}</p>
                </div>
              </div>

              {creatingSupplier && (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="assistant-supplier-name">Nombre del proveedor</Label>
                    <Input id="assistant-supplier-name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="assistant-supplier-taxid">Identificación tributaria</Label>
                    <Input id="assistant-supplier-taxid" value={supplierTaxId} onChange={(e) => setSupplierTaxId(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="assistant-supplier-contact">Contacto</Label>
                    <Input id="assistant-supplier-contact" value={supplierContactName} onChange={(e) => setSupplierContactName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="assistant-supplier-email">Correo</Label>
                    <Input id="assistant-supplier-email" type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="assistant-supplier-phone">Teléfono</Label>
                    <Input id="assistant-supplier-phone" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
                  </div>
                  <Button type="button" className="sm:col-span-2" onClick={handleCreateSupplier} disabled={loading || !supplierName.trim()}>
                    Guardar proveedor
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="font-medium">Líneas encontradas ({extraction.items.length})</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExtraction(null)
                    setFile(null)
                  }}
                >
                  Cambiar archivo
                </Button>
              </div>
              <div className="space-y-3">
                {extraction.items.map((item, index) => (
                  <div key={`${item.ingredientName}-${index}`} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.ingredientName}</p>
                        <p className="text-sm text-muted-foreground">
                          Cantidad: {item.quantity} · Costo unitario: {item.unitCost.toLocaleString()}
                          {item.categoryName ? ` · Categoría: ${item.categoryName}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Select
                        value={selectedIngredientIds[index] || ""}
                        onValueChange={(value) => setSelectedIngredientIds((current) => ({ ...current, [index]: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona o crea el ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {knownIngredients.filter((ingredient) => ingredient.locationId === locationId).map((ingredient) => (
                            <SelectItem key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => {
                        setCreatingIngredientIndex((current) => current === index ? null : index)
                        setIngredientNames((current) => ({ ...current, [index]: current[index] || item.ingredientName }))
                      }}>
                        <Plus className="mr-2 h-4 w-4" /> Crear ingrediente
                      </Button>
                    </div>

                    {creatingIngredientIndex === index && (
                      <div className="grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Nombre</Label>
                          <Input value={ingredientNames[index] || ""} onChange={(e) => setIngredientNames((current) => ({ ...current, [index]: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Unidad base</Label>
                          <Input value={ingredientUnits[index] || ""} placeholder="kg, g, l, unidad..." onChange={(e) => setIngredientUnits((current) => ({ ...current, [index]: e.target.value }))} />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                          <Label>Categoría de ingrediente</Label>
                          <Select
                            value={ingredientCategoryIds[index] || ""}
                            onValueChange={(value) => setIngredientCategoryIds((current) => ({ ...current, [index]: value === "__none__" ? "" : value }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sin categoría</SelectItem>
                              {knownCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 sm:col-span-2">
                          <Input
                            placeholder="Nueva categoría"
                            value={categoryNames[index] || ""}
                            onChange={(e) => setCategoryNames((current) => ({ ...current, [index]: e.target.value }))}
                          />
                          <Button type="button" variant="outline" onClick={() => handleCreateCategory(index)} disabled={loading || !categoryNames[index]?.trim()}>
                            Crear categoría
                          </Button>
                        </div>
                        <Button type="button" className="sm:col-span-2" onClick={() => handleCreateIngredient(index)} disabled={loading || !ingredientNames[index]?.trim() || !ingredientUnits[index]?.trim()}>
                          Guardar ingrediente con existencias iniciales en cero
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                  Los proveedores, categorías e ingredientes creados se guardan inmediatamente, incluso si cancelas. Los ingredientes nuevos comienzan con existencias en cero; el inventario aumenta solo al registrar la compra.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          {extraction && (
            <Button type="button" onClick={handleUseExtraction} disabled={loading}>
              Usar datos y revisar compra
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
