"use client"

import { LocationsManager } from "@/components/admin/locations/locations-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LocationsPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Ubicaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationsManager />
        </CardContent>
      </Card>
    </div>
  )
} 