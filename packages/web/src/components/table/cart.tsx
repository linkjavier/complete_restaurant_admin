"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Users, CheckCircle2 } from "lucide-react"
import { OrderItem, Product, getAuthToken } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { io } from "socket.io-client"

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
  const { toast } = useToast()

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
      
      // Construir el objeto de datos para la orden
      const orderData = {
        tableId,
        locationId,
        type: "TABLE" as const,
        items: items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        source: 'QR',
      };
      
      // Solo añadir splitBill si es necesario
      if (splitBill && splitNames.length > 0) {
        (orderData as any).splitBill = splitNames;
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error('Error al crear el pedido: ' + (errorData.message || response.statusText));
      }

      const newOrder = await response.json();

      // Conectar al socket y emitir el evento de nueva orden
      const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
        transports: ['websocket'],
        path: '/socket.io',
      });

      socket.on('connect', () => {
        socket.emit('join-kitchen', locationId);
        socket.emit('new_order_created', newOrder);
        socket.disconnect();
      });

      toast({
        title: "Éxito",
        description: (
          <span className="flex items-center justify-between text-green-600">
            <span>Pedido enviado correctamente</span>
            <CheckCircle2 className="ml-4" style={{ width: '60px', height: '60px' }} />
          </span>
        ),
        variant: "default",
        duration: 5000
      });
      onItemsChange([]); // Limpiar el carrito
      
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error al enviar el pedido',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
                    ${item.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newItems = items.map((i) =>
                        i.id === item.id
                          ? { ...i, quantity: Math.max(0, i.quantity - 1) }
                          : i
                      )
                      onItemsChange(newItems.filter((i) => i.quantity > 0))
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span>{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newItems = items.map((i) =>
                        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                      )
                      onItemsChange(newItems)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dividir Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant={splitBill ? "default" : "outline"}
                onClick={() => setSplitBill(!splitBill)}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                {splitBill ? "No Dividir" : "Dividir Cuenta"}
              </Button>
            </div>

            {splitBill && (
              <div className="space-y-2">
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
                <Button
                  variant="outline"
                  onClick={handleAddSplit}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Comensal
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total:</span>
            <div className="text-lg font-bold">
              ${total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <Button
            className="w-full mt-4"
            onClick={handleConfirmOrder}
            disabled={items.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Confirmar Pedido"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}