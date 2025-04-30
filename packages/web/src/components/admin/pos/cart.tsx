"use client"

import { Product } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus, Trash2 } from "lucide-react"
import { Table } from "@/lib/api"

interface CartItem {
  product: Product
  quantity: number
}

interface CartProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  orderType: "table" | "takeout"
  selectedTable: string | null
  tables: Table[]
  onOrderTypeChange: (type: "table" | "takeout") => void
  onTableSelect: (tableId: string) => void
  onSubmit: () => void
}

export function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  orderType,
  selectedTable,
  tables,
  onOrderTypeChange,
  onTableSelect,
  onSubmit,
}: CartProps) {
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Carrito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant={orderType === "table" ? "default" : "outline"}
              onClick={() => onOrderTypeChange("table")}
            >
              Mesa
            </Button>
            <Button
              variant={orderType === "takeout" ? "default" : "outline"}
              onClick={() => onOrderTypeChange("takeout")}
            >
              Para Llevar
            </Button>
          </div>

          {orderType === "table" && (
            <select
              className="w-full p-2 border rounded-md"
              value={selectedTable || ""}
              onChange={(e) => onTableSelect(e.target.value)}
            >
              <option value="">Seleccionar mesa</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  Mesa {table.number}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between p-2 border rounded-md"
            >
              <div className="flex-1">
                <p className="font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  ${item.product.price.toFixed(2)} x {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onUpdateQuantity(item.product.id, item.quantity - 1)
                  }
                  disabled={item.quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdateQuantity(item.product.id, parseInt(e.target.value))
                  }
                  className="w-16 text-center"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onUpdateQuantity(item.product.id, item.quantity + 1)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveItem(item.product.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold">Total:</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full"
            onClick={onSubmit}
            disabled={items.length === 0 || (orderType === "table" && !selectedTable)}
          >
            Enviar Orden
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 