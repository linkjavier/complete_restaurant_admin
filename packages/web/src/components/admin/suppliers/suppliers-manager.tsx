"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowLeft, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  archiveSupplier,
  createSupplier,
  getIngredients,
  getSupplier,
  getSuppliers,
  Ingredient,
  saveSupplierIngredient,
  Supplier,
  SupplierIngredient,
  removeSupplierIngredient,
  updateSupplier,
} from "@/lib/api"

type SupplierForm = {
  name: string
  taxId: string
  contactName: string
  email: string
  phone: string
  address: string
  notes: string
}

const emptyForm: SupplierForm = {
  name: "",
  taxId: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
}

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)
  const [ingredientId, setIngredientId] = useState("")
  const [catalogSku, setCatalogSku] = useState("")
  const [catalogCost, setCatalogCost] = useState("")
  const [catalogPackaging, setCatalogPackaging] = useState("")
  const [catalogMinimum, setCatalogMinimum] = useState("")
  const [catalogLeadTime, setCatalogLeadTime] = useState("")
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [supplierData, ingredientData] = await Promise.all([
        getSuppliers({ includeInactive: true }),
        getIngredients(),
      ])
      setSuppliers(supplierData)
      setIngredients(ingredientData)
    } catch (error) {
      toast({
        title: "No se pudieron cargar los proveedores",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (mobileDetailOpen && window.matchMedia("(max-width: 1279px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start" })
    }
  }, [mobileDetailOpen])

  const visibleSuppliers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return suppliers.filter((supplier) =>
      !query ||
      [supplier.name, supplier.taxId, supplier.contactName, supplier.email]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    )
  }, [search, suppliers])

  const openSupplier = async (supplier: Supplier) => {
    setSaving(true)
    try {
      const details = await getSupplier(supplier.id)
      setSelected(details)
      setIsCreating(false)
      setMobileDetailOpen(true)
      setForm({
        name: details.name,
        taxId: details.taxId || "",
        contactName: details.contactName || "",
        email: details.email || "",
        phone: details.phone || "",
        address: details.address || "",
        notes: details.notes || "",
      })
      clearCatalogForm()
    } catch (error) {
      toast({
        title: "No se pudo abrir el proveedor",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const clearCatalogForm = () => {
    setIngredientId("")
    setCatalogSku("")
    setCatalogCost("")
    setCatalogPackaging("")
    setCatalogMinimum("")
    setCatalogLeadTime("")
  }

  const handleNew = () => {
    setSelected(null)
    setIsCreating(true)
    setMobileDetailOpen(true)
    setForm(emptyForm)
    clearCatalogForm()
  }

  const handleSaveSupplier = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        taxId: form.taxId.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      }
      const saved = selected
        ? await updateSupplier(selected.id, payload)
        : await createSupplier({ ...payload, email: payload.email || undefined })
      setSelected({ ...saved, ingredients: selected?.ingredients ?? [], purchases: selected?.purchases ?? [] })
      setIsCreating(false)
      await loadData()
      toast({ title: "Proveedor guardado", description: saved.name })
    } catch (error) {
      toast({
        title: "No se pudo guardar el proveedor",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await archiveSupplier(selected.id)
      setSelected({ ...selected, isActive: false })
      await loadData()
      toast({ title: "Proveedor archivado", description: "Se conserva su historial de compras." })
    } catch (error) {
      toast({
        title: "No se pudo archivar el proveedor",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReactivate = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await updateSupplier(selected.id, { isActive: true })
      setSelected({ ...selected, ...updated })
      await loadData()
      toast({ title: "Proveedor reactivado" })
    } catch (error) {
      toast({
        title: "No se pudo reactivar el proveedor",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSelectIngredient = (value: string) => {
    setIngredientId(value)
    const existing = selected?.ingredients?.find((item) => item.ingredientId === value)
    setCatalogSku(existing?.supplierSku || "")
    setCatalogCost(existing?.unitCost?.toString() || "")
    setCatalogPackaging(existing?.packaging || "")
    setCatalogMinimum(existing?.minimumOrderQuantity?.toString() || "")
    setCatalogLeadTime(existing?.leadTimeDays?.toString() || "")
  }

  const handleSaveCatalogItem = async () => {
    if (!selected || !ingredientId) return
    setSaving(true)
    try {
      await saveSupplierIngredient(selected.id, {
        ingredientId,
        supplierSku: catalogSku.trim() || undefined,
        unitCost: catalogCost ? Number(catalogCost) : undefined,
        packaging: catalogPackaging.trim() || undefined,
        minimumOrderQuantity: catalogMinimum ? Number(catalogMinimum) : undefined,
        leadTimeDays: catalogLeadTime ? Number(catalogLeadTime) : undefined,
      })
      await openSupplier(selected)
      toast({ title: "Catálogo actualizado" })
    } catch (error) {
      toast({
        title: "No se pudo guardar el ingrediente",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      })
      setSaving(false)
    }
  }

  const handleRemoveCatalogItem = async (item: SupplierIngredient) => {
    if (!selected) return
    setSaving(true)
    try {
      await removeSupplierIngredient(selected.id, item.ingredientId)
      await openSupplier(selected)
      toast({ title: "Ingrediente quitado del catálogo" })
    } catch (error) {
      toast({
        title: "No se pudo quitar el ingrediente",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      })
      setSaving(false)
    }
  }

  const updateForm = (field: keyof SupplierForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className={`h-fit min-w-0 ${mobileDetailOpen ? "hidden xl:block" : ""}`}>
        <CardHeader className="space-y-3 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Proveedores</CardTitle>
            <Button size="sm" onClick={handleNew} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar proveedor" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando proveedores...</p>
          ) : visibleSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay proveedores para mostrar.</p>
          ) : visibleSuppliers.map((supplier) => (
            <button
              type="button"
              key={supplier.id}
              disabled={saving}
              onClick={() => void openSupplier(supplier)}
              className={`w-full rounded-md border p-3 text-left hover:bg-muted/50 ${selected?.id === supplier.id ? "border-primary bg-muted/40" : ""}`}
            >
              <span className="flex items-start justify-between gap-2 font-medium">
                <span className="min-w-0 break-words">{supplier.name}</span>
                {!supplier.isActive && <span className="shrink-0 text-xs text-muted-foreground">Archivado</span>}
              </span>
              <span className="mt-1 block break-words text-sm text-muted-foreground">
                {supplier.contactName || supplier.taxId || supplier.email || "Sin datos de contacto"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {supplier._count?.purchases ?? 0} compras · {supplier._count?.ingredients ?? 0} ingredientes
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div ref={detailRef} className={`min-w-0 scroll-mt-20 space-y-4 sm:space-y-6 ${mobileDetailOpen ? "" : "hidden xl:block"}`}>
        {(selected || isCreating) ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="xl:hidden"
              onClick={() => setMobileDetailOpen(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a proveedores
            </Button>
            <Card>
              <CardHeader className="flex flex-col items-start gap-3 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <CardTitle>{selected ? "Ficha del proveedor" : "Nuevo proveedor"}</CardTitle>
                <div className="flex w-full gap-2 sm:w-auto">
                  {selected && selected.isActive && (
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleArchive} disabled={saving}>
                      <Archive className="mr-2 h-4 w-4" /> Archivar
                    </Button>
                  )}
                  {selected && !selected.isActive && (
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleReactivate} disabled={saving}>
                      Reactivar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nombre / razón social</Label>
                  <Input value={form.name} onChange={(e) => updateForm("name", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Identificación tributaria</Label>
                  <Input value={form.taxId} onChange={(e) => updateForm("taxId", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Persona de contacto</Label>
                  <Input value={form.contactName} onChange={(e) => updateForm("contactName", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Correo</Label>
                  <Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Dirección</Label>
                  <Input value={form.address} onChange={(e) => updateForm("address", e.target.value)} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Notas</Label>
                  <Textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
                  {selected && (
                    <Button type="button" variant="outline" onClick={() => void openSupplier(selected)} disabled={saving}>
                      <Pencil className="mr-2 h-4 w-4" /> Descartar cambios
                    </Button>
                  )}
                  <Button onClick={handleSaveSupplier} disabled={saving || !form.name.trim()}>
                    {saving ? "Guardando..." : selected ? "Guardar cambios" : "Crear proveedor"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selected && (
              <>
                <Card>
                  <CardHeader className="p-4 sm:p-6"><CardTitle>Catálogo de ingredientes</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="grid min-w-0 gap-2 md:col-span-2">
                        <Label>Ingrediente</Label>
                        <select
                          className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                          value={ingredientId}
                          onChange={(event) => handleSelectIngredient(event.target.value)}
                        >
                          <option value="">Selecciona un ingrediente</option>
                          {ingredients.map((ingredient) => (
                            <option key={ingredient.id} value={ingredient.id}>
                              {ingredient.name} ({ingredient.unit}) — {ingredient.location?.name || "Sucursal"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>SKU del proveedor</Label>
                        <Input value={catalogSku} onChange={(e) => setCatalogSku(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Costo por unidad base</Label>
                        <Input type="number" min="0" step="any" value={catalogCost} onChange={(e) => setCatalogCost(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Presentación</Label>
                        <Input placeholder="Ej. caja x 12, saco de 25 kg" value={catalogPackaging} onChange={(e) => setCatalogPackaging(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Pedido mínimo (unidad base)</Label>
                        <Input type="number" min="0" step="any" value={catalogMinimum} onChange={(e) => setCatalogMinimum(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Plazo de entrega (días)</Label>
                        <Input type="number" min="0" step="1" value={catalogLeadTime} onChange={(e) => setCatalogLeadTime(e.target.value)} />
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full sm:w-auto" onClick={handleSaveCatalogItem} disabled={saving || !ingredientId}>
                          Guardar en catálogo
                        </Button>
                      </div>
                    </div>
                    {selected.ingredients?.length ? (
                      <div className="space-y-2">
                        {selected.ingredients.map((item) => (
                          <div key={item.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 break-words">
                              <p className="font-medium">{item.ingredient.name} <span className="text-sm font-normal text-muted-foreground">({item.ingredient.unit})</span></p>
                              <p className="text-sm text-muted-foreground">
                                {item.ingredient.location?.name || "Sucursal"} · {item.supplierSku || "Sin SKU"} · Costo: {item.unitCost ?? "—"} · {item.packaging || "Sin presentación"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Pedido mínimo: {item.minimumOrderQuantity ?? "—"} · Entrega: {item.leadTimeDays ?? "—"} días
                              </p>
                            </div>
                            <Button className="self-end sm:shrink-0" variant="ghost" size="icon" onClick={() => void handleRemoveCatalogItem(item)} disabled={saving} aria-label={`Quitar ${item.ingredient.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Todavía no hay ingredientes asociados a este proveedor.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 sm:p-6"><CardTitle>Historial de compras recientes</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {selected.purchases?.length ? selected.purchases.map((purchase) => (
                      <div key={purchase.id} className="break-words rounded-md border p-3">
                        <div className="flex flex-col justify-between gap-1 sm:flex-row">
                          <p className="font-medium">{new Date(purchase.purchaseDate).toLocaleDateString()} · {purchase.location?.name || "Sucursal"}</p>
                          <p className="text-sm text-muted-foreground">Total: {purchase.totalCost?.toFixed(2) ?? "0.00"}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {purchase.items?.map((item) => `${item.ingredient?.name || "Ingrediente"} × ${item.quantity}`).join(" · ") || "Sin detalle de artículos"}
                        </p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No hay compras registradas para este proveedor.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Selecciona un proveedor para ver su ficha, catálogo e historial, o crea uno nuevo.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
