"use client";

import { KitchenManager } from "@/components/admin/kitchen"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function KitchenManagerPage() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CHEF', 'ADMIN', 'MANAGER']}>
      <div className="w-full h-full">
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Cocina</CardTitle>
          </CardHeader>
          <CardContent>
            <KitchenManager />
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}