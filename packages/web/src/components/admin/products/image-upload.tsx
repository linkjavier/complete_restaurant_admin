"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { API_URL } from '@/lib/api'

interface ImageUploadProps {
  onImageUploaded: (url: string) => void
  currentImage?: string
  buttonText?: string
}

export function ImageUpload({ onImageUploaded, currentImage, buttonText }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log(`[Frontend] Received image: ${file.name}, type: ${file.type}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Por favor, sube solo archivos de imagen",
        variant: "destructive",
      })
      return
    }

    // Validar tamaño (máximo 15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen no debe superar los 15MB",
        variant: "destructive",
      })
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'Error al subir la imagen';
        try {
          // Leer la respuesta como texto una sola vez
          const textError = await response.text();
          try {
            // Intentar parsear el texto como JSON
            const errorData = JSON.parse(textError);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // Si no es JSON, usar el texto directamente si tiene contenido
            if (textError) {
              errorMessage = textError;
            } else {
              errorMessage = `Error: ${response.status} ${response.statusText}`;
            }
          }
        } catch (e) {
            // Fallback si hay problemas leyendo el cuerpo de la respuesta
            errorMessage = `Error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json()
      onImageUploaded(data.url)
      
      toast({
        title: "Éxito",
        description: "Imagen subida correctamente",
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al subir la imagen. Por favor, intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {currentImage && (
        <div className="relative w-40 h-40">
          <img
            src={currentImage}
            alt="Product preview"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
          id="image-upload"
        />
        <Button
          variant="outline"
          disabled={uploading}
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => document.getElementById('image-upload')?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Subiendo..." : buttonText || "Subir Imagen"}
        </Button>
      </div>
    </div>
  )
} 