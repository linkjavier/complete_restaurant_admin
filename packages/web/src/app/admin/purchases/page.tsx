"use client"

import { PurchasesManager } from "@/components/admin/purchases/purchases-manager"

export default function PurchasesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Compras</h2>
      </div>
      <PurchasesManager />
    </div>
  )
}
