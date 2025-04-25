"use client"

import { IngredientsManager } from "@/components/admin/ingredients/ingredients-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function IngredientsPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Ingredientes</CardTitle>
        </CardHeader>
        <CardContent>
          <IngredientsManager />
        </CardContent>
      </Card>
    </div>
  )
} 