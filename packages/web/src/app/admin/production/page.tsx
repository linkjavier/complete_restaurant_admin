"use client"

import { ProductionManager } from "@/components/admin/production/production-manager"

export default function ProductionPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Producción</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepara productos por lote, controla la merma y revisa el inventario utilizado.
        </p>
      </header>
      <ProductionManager />
    </div>
  )
}
