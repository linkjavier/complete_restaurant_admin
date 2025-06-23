"use client"

import { ProductsManager } from "@/components/admin/products/products-manager"

export default function ProductsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Productos</h2>
      </div>
          <ProductsManager />
    </div>
  )
} 