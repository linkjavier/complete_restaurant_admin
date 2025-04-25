"use client"

import { TablesManager } from "@/components/admin/tables/tables-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TablesPage() {
  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Mesas</CardTitle>
        </CardHeader>
        <CardContent>
          <TablesManager />
        </CardContent>
      </Card>
    </div>
  )
} 