"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, ExternalLink, Plus, QrCode, Save, Trash2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { ALL_LOCATIONS, useLocationSelection } from "@/hooks/use-location-selection"
import {
  getQrMenuConfiguration,
  QrMenuConfiguration,
  QrMenuConfigurationUpdate,
  saveQrMenuConfiguration,
} from "@/lib/api"

export default function QrMenuManagerPage() {
  const { user } = useAuth()
  const { selectedLocationId } = useLocationSelection()
  const locationId = user?.role === "SUPER_ADMIN"
    ? selectedLocationId === ALL_LOCATIONS ? "" : selectedLocationId
    : user?.locationId ?? ""
  const [configuration, setConfiguration] = useState<QrMenuConfiguration | null>(null)
  const [loadingConfiguration, setLoadingConfiguration] = useState(false)
  const [configurationError, setConfigurationError] = useState("")
  const [saving, setSaving] = useState(false)
  const [configurationRetry, setConfigurationRetry] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setConfiguration(null)
      setConfigurationError("")
      setLoadingConfiguration(false)
      return
    }
    let active = true
    setConfiguration(null)
    setConfigurationError("")
    setLoadingConfiguration(true)
    getQrMenuConfiguration(locationId)
      .then((data) => {
        if (active) setConfiguration(data)
      })
      .catch((error: unknown) => {
        if (active) {
          setConfiguration(null)
          setConfigurationError(error instanceof Error ? error.message : "No se pudo cargar el Menú QR")
        }
      })
      .finally(() => {
        if (active) setLoadingConfiguration(false)
      })
    return () => { active = false }
  }, [configurationRetry, locationId])

  const publicUrl = useMemo(() => (
    typeof window !== "undefined" && locationId
      ? `${window.location.origin}/menu/${encodeURIComponent(locationId)}`
      : ""
  ), [locationId])

  const update = (patch: Partial<QrMenuConfigurationUpdate>) => {
    setConfiguration((current) => current ? { ...current, ...patch } : current)
  }

  const save = async () => {
    if (!configuration || !locationId) return
    setSaving(true)
    try {
      const payload: QrMenuConfigurationUpdate = {
        enabled: configuration.enabled,
        orderingEnabled: configuration.orderingEnabled,
        primaryColor: configuration.primaryColor,
        whatsappPhone: configuration.whatsappPhone,
        productIds: configuration.productIds,
        banners: configuration.banners,
      }
      const saved = await saveQrMenuConfiguration(locationId, payload)
      setConfiguration(saved)
      toast.success("Menú QR guardado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el Menú QR")
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success("Enlace copiado")
    } catch {
      toast.error("No se pudo copiar el enlace")
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-12 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menú QR</h1>
          <p className="mt-1 text-muted-foreground">
            {user?.role === "SUPER_ADMIN" && !locationId
              ? "Selecciona la ubicación desde la barra superior para configurar su menú."
              : "Diseña y comparte la página interactiva de tu negocio."}
          </p>
        </div>
        {configuration && (
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        )}
      </div>

      {loadingConfiguration && (
        <p role="status" className="p-4 text-center text-muted-foreground">Cargando la configuración de esta sede…</p>
      )}
      {!loadingConfiguration && !locationId && (
        <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
          {user?.role === "SUPER_ADMIN"
            ? "Selecciona una ubicación desde la barra superior para abrir su editor de Menú QR."
            : "Tu usuario no tiene una ubicación asignada para configurar el Menú QR."}
        </p>
      )}
      {configurationError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">No se pudo cargar el editor de esta sede.</p>
          <p className="mt-1 text-muted-foreground">{configurationError}</p>
          <p className="mt-2 text-muted-foreground">
            Si el API acaba de actualizarse, reinicia el servidor de la API y vuelve a intentar.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => setConfigurationRetry((current) => current + 1)}
          >
            Reintentar
          </Button>
        </div>
      )}

      {!configuration && (
        <div className="sr-only" aria-hidden="true" />
      )}
      {configuration && (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publicación y pedidos</CardTitle>
              <CardDescription>Controla la visibilidad del menú y el carrito de WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <Label htmlFor="menu-enabled">Publicar Menú QR</Label>
                  <p className="mt-1 text-sm text-muted-foreground">El enlace estará disponible para cualquier cliente.</p>
                </div>
                <Switch
                  id="menu-enabled"
                  checked={configuration.enabled}
                  onCheckedChange={(enabled) => update({ enabled })}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <Label htmlFor="ordering-enabled">Activar carrito y pedidos por WhatsApp</Label>
                  <p className="mt-1 text-sm text-muted-foreground">El cliente arma su pedido y lo envía al WhatsApp configurado.</p>
                </div>
                <Switch
                  id="ordering-enabled"
                  checked={configuration.orderingEnabled}
                  onCheckedChange={(orderingEnabled) => update({ orderingEnabled })}
                />
              </div>
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                El checkout con pagos online requiere conectar un proveedor de pagos para pedidos de clientes. Esta configuración no cobra ni confirma pagos.
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-number">WhatsApp del negocio</Label>
                  <Input
                    id="whatsapp-number"
                    value={configuration.whatsappPhone}
                    onChange={(event) => update({ whatsappPhone: event.target.value })}
                    placeholder="Ej. 573001234567"
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-color">Color principal</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="menu-color"
                      type="color"
                      value={configuration.primaryColor}
                      onChange={(event) => update({ primaryColor: event.target.value })}
                      className="h-10 w-16 p-1"
                    />
                    <span className="text-sm text-muted-foreground">{configuration.primaryColor}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos visibles</CardTitle>
              <CardDescription>Las preparaciones internas y los productos inactivos no aparecen aquí ni en el menú público.</CardDescription>
            </CardHeader>
            <CardContent>
              {configuration.products.length ? (
                <div className="divide-y rounded-md border">
                  {configuration.products.map((product) => {
                    const checked = configuration.productIds.includes(product.id)
                    return (
                      <label key={product.id} className="flex cursor-pointer items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => update({
                            productIds: event.target.checked
                              ? [...configuration.productIds, product.id]
                              : configuration.productIds.filter((id) => id !== product.id),
                          })}
                          className="h-4 w-4 accent-orange-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{product.name}</span>
                          <span className="text-sm text-muted-foreground">{product.category?.name || "Sin categoría"}</span>
                        </span>
                        <span className="text-sm font-semibold">${product.price.toLocaleString("es-CO")}</span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay productos vendibles activos en esta ubicación.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Banners y promociones</CardTitle>
                  <CardDescription>Publica hasta 10 anuncios en el menú de tus clientes.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={configuration.banners.length >= 10}
                  onClick={() => update({
                    banners: [...configuration.banners, { title: "Nueva promoción", description: "", imageUrl: "", isActive: true }],
                  })}
                >
                  <Plus className="mr-1 h-4 w-4" /> Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {configuration.banners.map((banner, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={banner.isActive}
                        onCheckedChange={(isActive) => update({
                          banners: configuration.banners.map((item, itemIndex) => itemIndex === index ? { ...item, isActive } : item),
                        })}
                        aria-label={`Mostrar banner ${index + 1}`}
                      />
                      <span className="text-sm">{banner.isActive ? "Visible" : "Oculto"}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar banner"
                      onClick={() => update({ banners: configuration.banners.filter((_, itemIndex) => itemIndex !== index) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={banner.title}
                    maxLength={100}
                    aria-label="Título del banner"
                    onChange={(event) => update({
                      banners: configuration.banners.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item),
                    })}
                    placeholder="Título de la promoción"
                  />
                  <Textarea
                    value={banner.description || ""}
                    maxLength={240}
                    aria-label="Descripción del banner"
                    onChange={(event) => update({
                      banners: configuration.banners.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item),
                    })}
                    placeholder="Descripción breve"
                  />
                  <Input
                    value={banner.imageUrl || ""}
                    maxLength={2048}
                    aria-label="Imagen del banner"
                    onChange={(event) => update({
                      banners: configuration.banners.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl: event.target.value } : item),
                    })}
                    placeholder="URL de imagen https://… (opcional)"
                  />
                </div>
              ))}
              {!configuration.banners.length && <p className="text-sm text-muted-foreground">Aún no hay promociones. Puedes agregar hasta 10.</p>}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              <CardTitle>Enlace público</CardTitle>
            </div>
            <CardDescription>Comparte este link o descarga el código QR desde tu navegador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={publicUrl} size={176} level="M" />
            </div>
            <p className="break-all rounded-md bg-muted p-3 text-sm">{publicUrl}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={copyLink}>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  )
}
