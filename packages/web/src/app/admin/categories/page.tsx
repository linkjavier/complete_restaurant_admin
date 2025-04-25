"use client"

import { CategoriesManager } from "@/components/admin/categories/categories-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CategoriesPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Administrar Categorías</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoriesManager />
        </CardContent>
      </Card>
    </div>
  )
} 