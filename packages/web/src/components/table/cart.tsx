"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Users } from "lucide-react"
import { OrderItem } from "@/types/table"

interface CartProps {
  customerName: string
  tableId: string
}

export function Cart({ customerName, tableId }: CartProps) {
  const [items, setItems] = useState<OrderItem[]>([])
  const [splitBill, setSplitBill] = useState(false)
  const [splitNames, setSplitNames] = useState<string[]>([customerName])

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleAddSplit = () => {
    setSplitNames((prev) => [...prev, ""])
  }

  const handleRemoveSplit = (index: number) => {
    setSplitNames((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSplitNameChange = (index: number, value: string) => {
    setSplitNames((prev) => {
      const newNames = [...prev]
      newNames[index] = value
      return newNames
    })
  }

  const handleConfirmOrder = () => {
    // Implementar lógica para enviar el pedido
    console.log("Confirmando pedido...", {
      customerName,
      tableId,
      items,
      splitBill,
      splitNames,
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tu Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b pb-2"
              >
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ${item.price.toFixed(2)} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setItems((prev) =>
                        prev.map((i) =>
                          i.id === item.id
                            ? { ...i, quantity: Math.max(0, i.quantity - 1) }
                            : i
                        )
                      )
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setItems((prev) =>
                        prev.map((i) =>
                          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                        )
                      )
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dividir Cuenta</CardTitle>
            <Button
              variant="outline"
              onClick={() => setSplitBill(!splitBill)}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {splitBill ? "No Dividir" : "Dividir Cuenta"}
            </Button>
          </div>
        </CardHeader>
        {splitBill && (
          <CardContent className="space-y-4">
            {splitNames.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Nombre del comensal"
                  value={name}
                  onChange={(e) => handleSplitNameChange(index, e.target.value)}
                />
                {index > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveSplit(index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={handleAddSplit}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Comensal
            </Button>
          </CardContent>
        )}
      </Card>

      <Button
        className="w-full"
        onClick={handleConfirmOrder}
        disabled={items.length === 0}
      >
        Confirmar Pedido
      </Button>
    </div>
  )
} 