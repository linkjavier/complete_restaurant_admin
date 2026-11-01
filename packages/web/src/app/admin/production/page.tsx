"use client"

import { ProductionManager } from "@/components/admin/production/production-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProductionPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Producción</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductionManager />
        </CardContent>
      </Card>
    </div>
  )
}
