"use client"

import { KitchenManager } from "@/components/admin/kitchen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function KitchenManagerPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cocina</CardTitle>
        </CardHeader>
        <CardContent>
          <KitchenManager />
        </CardContent>
      </Card>
    </div>
  )
} 