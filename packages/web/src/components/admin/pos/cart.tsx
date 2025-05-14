"use client"

import { useState } from "react"
import { Product } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus, Trash2 } from "lucide-react"
import { Table } from "@/lib/api"
import { PaymentDialog } from "@/components/admin/pos/payment-dialog"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

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
  loading?: boolean
  currentOrders: {
    id: string
    status: string
    total: number
    items: {
      id: string
      product: {
        name: string
        price: number
      }
      quantity: number
      status: string
    }[]
  }[]
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
  loading = false,
  currentOrders = [],
}: CartProps) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const cartTotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'READY': 'bg-green-100 text-green-800',
      'DELIVERED': 'bg-gray-100 text-gray-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'PENDING' ? 'Pendiente' :
         status === 'IN_PROGRESS' ? 'En Preparación' :
         status === 'READY' ? 'Listo' :
         status === 'DELIVERED' ? 'Entregado' :
         status === 'CANCELLED' ? 'Cancelado' : status}
      </span>
    )
  }

  const ordersTotal = currentOrders.reduce(
    (sum, order) => sum + (order.total || order.items?.reduce((itemSum, item) => 
      itemSum + (item.product.price * item.quantity), 0) || 0),
    0
  )

  const allOrdersTotal = ordersTotal + cartTotal

  const handleSubmit = async () => {
    try {
      setIsProcessing(true)
      await onSubmit()
    } catch (error) {
      console.error('Error submitting order:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Carrito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-8">
            <LoadingSpinner />
            <p className="text-center mt-2 text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant={orderType === "table" ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("table")}
                  disabled={isProcessing}
                >
                  Mesa
                </Button>
                <Button
                  variant={orderType === "takeout" ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("takeout")}
                  disabled={isProcessing}
                >
                  Para Llevar
                </Button>
              </div>

              {orderType === "table" && (
                <select
                  className="w-full p-2 border rounded-md"
                  value={selectedTable || ""}
                  onChange={(e) => onTableSelect(e.target.value)}
                  disabled={isProcessing}
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

            {/* Resumen de Órdenes */}
            {selectedTable && currentOrders.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-medium mb-3">Resumen de Órdenes</h3>
                <div className="space-y-3">
                  {currentOrders.map((order) => (
                    <div key={order.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Orden #{order.id.slice(0, 8)}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="space-y-2">
                        {order.items?.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-background rounded">
                            <div className="flex-1">
                              <span className="font-medium">{item.product.name}</span>
                              <div className="text-muted-foreground">
                                ${item.product.price.toFixed(2)} x {item.quantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                ${(item.product.price * item.quantity).toFixed(2)}
                              </span>
                              {getStatusBadge(item.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-medium">Subtotal:</span>
                        <span className="font-medium">
                          ${(order.total || order.items?.reduce((sum, item) => 
                            sum + (item.product.price * item.quantity), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedOrderId(order.id)
                            setIsPaymentDialogOpen(true)
                          }}
                          disabled={isProcessing || loading}
                        >
                          Pagar
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t">
                    <div className="flex justify-between items-center font-medium">
                      <span>Total de Órdenes:</span>
                      <span>${ordersTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Carrito actual */}
            {items.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">Carrito Actual</h3>
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
                          disabled={item.quantity <= 1 || isProcessing}
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
                          disabled={isProcessing}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onUpdateQuantity(item.product.id, item.quantity + 1)
                          }
                          disabled={isProcessing}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveItem(item.product.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen y acciones */}
            <div className="border-t pt-4">
              {selectedTable && currentOrders.length > 0 && (
                <div className="flex justify-between items-center mb-2 text-sm text-muted-foreground">
                  <span>Órdenes activas:</span>
                  <span>${ordersTotal.toFixed(2)}</span>
                </div>
              )}
              {items.length > 0 && (
                <div className="flex justify-between items-center mb-2 text-sm text-muted-foreground">
                  <span>Carrito actual:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-4 text-lg font-bold">
                <span>Total:</span>
                <span>${allOrdersTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={
                    items.length === 0 ||
                    (orderType === "table" && !selectedTable) ||
                    isProcessing ||
                    loading
                  }
                >
                  {isProcessing ? (
                    <>
                      <LoadingSpinner />
                      <span className="ml-2">Enviando...</span>
                    </>
                  ) : (
                    "Enviar Orden"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
      
      {selectedOrderId && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false)
            setSelectedOrderId(null)
          }}
          orderId={selectedOrderId}
        />
      )}
    </Card>
  )
}