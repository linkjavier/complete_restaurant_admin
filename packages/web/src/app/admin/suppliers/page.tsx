"use client"

import { SuppliersManager } from "@/components/admin/suppliers/suppliers-manager"

export default function SuppliersPage() {
  return (
    <div className="min-w-0 flex-1 space-y-4 p-4 pt-6 sm:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Gestión de Proveedores</h2>
      </div>
      <SuppliersManager />
    </div>
  )
}
