"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function TestPage() {
  const router = useRouter()

  const handleAccessTable = (tableId: string) => {
    router.push(`/table/${tableId}`)
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Prueba de Acceso a Mesas</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((tableNumber) => (
          <Card key={tableNumber}>
            <CardHeader>
              <CardTitle>Mesa {tableNumber}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => handleAccessTable(tableNumber.toString())}
              >
                Acceder a Mesa {tableNumber}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 