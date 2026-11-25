"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { ImageUpload } from "@/components/admin/products/image-upload"
import { CategoryOrderManager } from "@/components/admin/settings/category-order-manager"
import { API_URL, getAuthHeaders, getLocations, type Location } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BillingSettingsTab } from "@/components/admin/settings/billing-settings-tab"

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState("")
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [aiName, setAiName] = useState("")
  const [aiGender, setAiGender] = useState("")
  const [aiEnabled, setAiEnabled] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState<number>(0)
  const { user, isLoading: isAuthLoading } = useAuth()
  const isSuperAdmin = user?.role === "SUPER_ADMIN"
  const locationId = selectedLocationId

  const { toast } = useToast()

  useEffect(() => {
    if (isAuthLoading) return
    if (!user) {
      setSelectedLocationId("")
      setIsLoadingLocations(false)
      setIsLoading(false)
      return
    }

    if (user.role !== "SUPER_ADMIN") {
      setSelectedLocationId(user.locationId ?? "")
      return
    }

    let cancelled = false
    setIsLoadingLocations(true)
    getLocations()
      .then((result) => {
        if (cancelled) return
        setLocations(result)
        const preferredLocationId =
          user.locationId && result.some((location) => location.id === user.locationId)
            ? user.locationId
            : result[0]?.id ?? ""
        setSelectedLocationId((current) =>
          result.some((location) => location.id === current)
            ? current
            : preferredLocationId,
        )
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Error al cargar las ubicaciones",
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLocations(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthLoading, user, toast])

  useEffect(() => {
    let cancelled = false
    if (!locationId) {
      setIsLoading(false)
      return () => {
        cancelled = true
      }
    }

    setIsLoading(true)
    const loadSettings = async () => {
      try {
        const query = `?locationId=${encodeURIComponent(locationId)}`
        const businessRes = await fetch(`${API_URL}/settings/business${query}`, {
          headers: getAuthHeaders(),
        })
        if (!businessRes.ok) throw new Error("Error al cargar la configuración del negocio")
        const data = await businessRes.json()
        if (cancelled) return
        setBusinessName(data.name || "")
        setBusinessIcon(data.logo || "")

        const aiRes = await fetch(`${API_URL}/settings/ai${query}`, {
          headers: getAuthHeaders(),
        })
        if (!aiRes.ok) throw new Error("Error al cargar la configuración de IA")
        const aiData = await aiRes.json()
        if (cancelled) return
        setAiName(aiData.name)
        setAiGender(aiData.gender)
        setAiEnabled(aiData.enabled)
        setDeliveryFee(aiData.deliveryFee ?? 0)
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Error al cargar la configuración",
            variant: "destructive"
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [locationId, toast])

  const handleSaveBusiness = async () => {
    setIsSaving(true)
    try {
      if (!locationId) throw new Error('No tienes una ubicación asignada. Contacta al administrador.')
      const response = await fetch(`${API_URL}/settings/business`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: businessName, logo: businessIcon, locationId })
      })
      if (!response.ok) throw new Error("Error al guardar la configuración del negocio")
      toast({
        title: "Éxito",
        description: "Configuración del negocio guardada exitosamente"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar la configuración del negocio",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!aiName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del asistente es requerido",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      if (!locationId) throw new Error('No tienes una ubicación asignada. Contacta al administrador.')
      const response = await fetch(`${API_URL}/settings/ai`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: aiName,
          gender: aiGender,
          enabled: aiEnabled,
          deliveryFee,
          locationId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      toast({
        title: "Éxito",
        description: "Configuración del Asistente IA guardada exitosamente"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar la configuración",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isAuthLoading || isLoadingLocations) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Configuración</h1>

      {isSuperAdmin ? (
        <div className="mb-6 max-w-sm space-y-2">
          <Label htmlFor="settings-location">Ubicación</Label>
          <Select
            value={locationId || undefined}
            onValueChange={setSelectedLocationId}
            disabled={locations.length === 0}
          >
            <SelectTrigger id="settings-location">
              <SelectValue placeholder="Selecciona una ubicación" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}{location.city ? ` · ${location.city}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {isSuperAdmin ? (
            <TabsTrigger value="billing">Facturación electrónica</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="general">
          {!locationId ? (
            <Card>
              <CardHeader>
                <CardTitle>Selecciona una ubicación</CardTitle>
                <CardDescription>
                  Asigna una ubicación a tu usuario o selecciona una para editar su configuración.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Sección de Configuración del negocio */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración del negocio</CardTitle>
            <CardDescription>
              Personaliza la información y apariencia general de tu negocio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Nombre del Negocio</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Ingresa el nombre del negocio"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label>Icono del Negocio</Label>
              {businessIcon && (
                <div className="flex items-center mb-2">
                  <img
                    src={businessIcon}
                    alt="Logo del negocio"
                    className="w-20 h-20 rounded-lg object-cover border"
                  />
                </div>
              )}
              <ImageUpload
                onImageUploaded={setBusinessIcon}
                currentImage={undefined}
                buttonText={businessIcon ? "Cambiar Logo" : "Subir Logo"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recomendado: PNG cuadrado, 256x256px o superior, fondo transparente.
              </p>
            </div>
            <Button onClick={handleSaveBusiness} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sección de Configuración del Asistente IA */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración del Asistente IA</CardTitle>
            <CardDescription>
              Personaliza el comportamiento y la apariencia de tu asistente virtual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-name">Nombre del Asistente</Label>
              <Input
                id="ai-name"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder="Ingresa el nombre del asistente"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-gender">Género del Asistente</Label>
              <Select
                value={aiGender}
                onValueChange={setAiGender}
                disabled={isSaving}
              >
                <SelectTrigger id="ai-gender">
                  <SelectValue placeholder="Selecciona el género" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="ai-enabled"
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
                disabled={isSaving}
              />
              <Label htmlFor="ai-enabled">Activar Asistente IA</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-fee">Valor de domicilio ($COP)</Label>
              <Input
                id="delivery-fee"
                type="number"
                min={0}
                value={deliveryFee}
                onChange={e => setDeliveryFee(Number(e.target.value))}
                disabled={isSaving}
                className="w-32"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sección de Orden de Categorías */}
        <CategoryOrderManager />
      </div>
          )}
        </TabsContent>

        {isSuperAdmin ? (
          <TabsContent value="billing">
            <BillingSettingsTab key={locationId} locationId={locationId} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
} 