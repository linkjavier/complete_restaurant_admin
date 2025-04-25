"use client"

import { ProductsManager } from "@/components/admin/products/products-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProductsPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductsManager />
        </CardContent>
      </Card>
    </div>
  )
} 