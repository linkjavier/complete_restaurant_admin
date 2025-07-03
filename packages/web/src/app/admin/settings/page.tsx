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
import { API_URL } from '@/lib/api'

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState("")
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [aiName, setAiName] = useState("")
  const [aiGender, setAiGender] = useState("")
  const [aiEnabled, setAiEnabled] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState<number>(0)

  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      // Cargar configuración del negocio
      const businessRes = await fetch(`${API_URL}/settings/business`)
      if (businessRes.ok) {
        const data = await businessRes.json()
        setBusinessName(data.name || "")
        setBusinessIcon(data.logo || "")
      }
      // Cargar configuración de IA
      const aiRes = await fetch(`${API_URL}/settings/ai`)
      if (aiRes.ok) {
        const data = await aiRes.json()
        setAiName(data.name)
        setAiGender(data.gender)
        setAiEnabled(data.enabled)
        setDeliveryFee(data.deliveryFee ?? 0)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar la configuración",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveBusiness = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`${API_URL}/settings/business`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: businessName, logo: businessIcon })
      })
      if (!response.ok) throw new Error("Error al guardar la configuración del negocio")
      toast({
        title: "Éxito",
        description: "Configuración del negocio guardada exitosamente"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar la configuración del negocio",
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
      const response = await fetch(`${API_URL}/settings/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: aiName,
          gender: aiGender,
          enabled: aiEnabled,
          deliveryFee,
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
        description: "Error al guardar la configuración",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Configuración</h1>
      
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
    </div>
  )
} 