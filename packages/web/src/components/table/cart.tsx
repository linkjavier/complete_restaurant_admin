"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Users } from "lucide-react"
import { OrderItem, Product } from "@/lib/api"
import { toast } from "sonner"

interface CartProps {
  customerName: string
  tableId: string
  locationId: string
  items: OrderItem[]
  onItemsChange: (items: OrderItem[]) => void
}

export function Cart({ customerName, tableId, locationId, items, onItemsChange }: CartProps) {
  const [splitBill, setSplitBill] = useState(false)
  const [splitNames, setSplitNames] = useState<string[]>([customerName])
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleConfirmOrder = async () => {
    try {
      setIsSubmitting(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          tableId,
          locationId,
          customerName,
          items: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.price
          })),
          splitBill: splitBill ? splitNames : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Error al crear el pedido')
      }

      toast.success('Pedido enviado correctamente')
      onItemsChange([]) // Limpiar el carrito
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al enviar el pedido')
    } finally {
      setIsSubmitting(false)
    }
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
                      onItemsChange(
                        items.map((i) =>
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
                      onItemsChange(
                        items.map((i) =>
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
        disabled={items.length === 0 || isSubmitting}
      >
        {isSubmitting ? "Enviando pedido..." : "Confirmar Pedido"}
      </Button>
    </div>
  )
} 