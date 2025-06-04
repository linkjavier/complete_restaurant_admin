"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
  const [aiName, setAiName] = useState("")
  const [aiGender, setAiGender] = useState("")
  const [aiEnabled, setAiEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings/ai")
      if (!response.ok) {
        throw new Error("Failed to load settings")
      }
      const data = await response.json()
      setAiName(data.name)
      setAiGender(data.gender)
      setAiEnabled(data.enabled)
    } catch (error) {
      toast.error("Error al cargar la configuración")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!aiName.trim()) {
      toast.error("El nombre del asistente es requerido")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/settings/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: aiName,
          gender: aiGender,
          enabled: aiEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      toast.success("Configuración guardada exitosamente")
    } catch (error) {
      toast.error("Error al guardar la configuración")
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
      
      <div className="grid gap-6">
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
      </div>
    </div>
  )
} 