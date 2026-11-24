"use client"

import { useEffect, useRef, useState } from "react"
import { createElement } from "react"
import type { ProductArExperience } from "@/lib/api"

export function ArProductViewer({
  productName,
  experience,
}: {
  productName: string
  experience: ProductArExperience
}) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [modelLoaded, setModelLoaded] = useState(false)
  const viewerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let active = true
    import("@google/model-viewer")
      .then(() => {
        if (active) setReady(true)
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el visor 3D. Intenta actualizar la página.")
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!ready || !viewer) return

    const handleLoad = () => setModelLoaded(true)
    const handleError = () => {
      setError(
        "No se pudo descargar el modelo 3D. Verifica que el bucket R2 tenga acceso público y CORS habilitado para el dominio de este menú.",
      )
    }
    viewer.addEventListener("load", handleLoad)
    viewer.addEventListener("error", handleError)
    return () => {
      viewer.removeEventListener("load", handleLoad)
      viewer.removeEventListener("error", handleError)
    }
  }, [ready])

  const scale = experience.scale
    ? `${experience.scale.x} ${experience.scale.y} ${experience.scale.z}`
    : "1 1 1"

  return (
    <div className="relative h-[min(70vh,32rem)] min-h-64 overflow-hidden rounded-xl bg-stone-100">
      {(!ready || !modelLoaded) && !error && (
        <p role="status" className="absolute inset-0 grid place-items-center text-sm text-stone-500">
          {ready ? "Descargando modelo 3D…" : "Cargando visor 3D…"}
        </p>
      )}
      {error ? (
        <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-red-700">
          {error}
        </p>
      ) : createElement("model-viewer", {
        ref: viewerRef,
        src: experience.model3dUrl,
        crossorigin: "anonymous",
        alt: `Modelo 3D de ${productName}`,
        ar: true,
        "ios-src": experience.modelUsdzUrl ?? undefined,
        "ar-modes": "webxr scene-viewer quick-look",
        "ar-placement": experience.placement,
        "ar-scale": "fixed",
        "camera-controls": true,
        "touch-action": "pan-y",
        "shadow-intensity": "1",
        "auto-rotate": true,
        scale,
        style: { width: "100%", height: "100%" },
      })}
    </div>
  )
}
