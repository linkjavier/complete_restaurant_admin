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
  customerName: string
  onCustomerNameChange: (name: string) => void
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
  customerName,
  onCustomerNameChange,
  currentOrders = [],
}: CartProps) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tempOrderId, setTempOrderId] = useState<string | null>(null)
  
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
      if (orderType === "takeout") {
        // Para llevar: mostrar diálogo de pago primero
        setTempOrderId("temp")  // ID temporal para el diálogo de pago
        setIsPaymentDialogOpen(true)
      } else {
        // Mesa: crear orden primero
        await onSubmit()
      }
    } catch (error) {
      console.error('Error submitting order:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentProcessed = async () => {
    if (orderType === "takeout") {
      // Después del pago, crear la orden
      await onSubmit()
    }
    setIsPaymentDialogOpen(false)
    setTempOrderId(null)
  }

  return (
    <Card className="h-[calc(100vh-4rem)] flex flex-col sticky top-16">
      <CardHeader className="flex-none p-2">
        <CardTitle className="text-lg">Carrito</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2 flex flex-col min-h-0">
        {loading ? (
          <div className="py-4">
            <LoadingSpinner />
            <p className="text-center mt-1 text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-none space-y-1">
              <div className="flex gap-1">
                <Button
                  variant={orderType === "takeout" ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("takeout")}
                  disabled={isProcessing}
                  size="sm"
                >
                  Para Llevar
                </Button>
                <Button
                  variant={orderType === "table" ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("table")}
                  disabled={isProcessing}
                  size="sm"
                >
                  Mesa
                </Button>
              </div>

              {orderType === "takeout" && (
                <Input
                  placeholder="Nombre del cliente"
                  value={customerName}
                  onChange={(e) => onCustomerNameChange(e.target.value)}
                  disabled={isProcessing}
                  className="h-8"
                />
              )}

              {orderType === "table" && (
                <select
                  className="w-full p-1 h-8 text-sm border rounded-md"
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

            <div className="flex-1 overflow-y-auto mt-2">
              {/* Resumen de Órdenes */}
              {selectedTable && currentOrders.length > 0 && (
                <div className="border rounded-lg p-2 bg-muted/50 mb-2">
                  <h3 className="font-medium text-sm mb-2">Resumen de Órdenes</h3>
                  <div className="space-y-2">
                    {currentOrders.map((order) => (
                      <div key={order.id} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium">Orden #{order.id.slice(0, 8)}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="space-y-1">
                          {order.items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-xs p-1 bg-background rounded">
                              <div className="flex-1">
                                <span className="font-medium">{item.product.name}</span>
                                <div className="text-muted-foreground">
                                  ${item.product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })} x {item.quantity}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">
                                  ${(item.product.price * item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                </span>
                                {getStatusBadge(item.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t">
                          <span className="text-xs font-medium">Subtotal:</span>
                          <span className="text-xs font-medium">
                            ${(order.total || order.items?.reduce((sum, item) => 
                              sum + (item.product.price * item.quantity), 0) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedOrderId(order.id)
                              setIsPaymentDialogOpen(true)
                            }}
                            disabled={isProcessing || loading}
                            className="h-6 text-xs"
                          >
                            Pagar
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1 mt-1 border-t">
                      <div className="flex justify-between items-center text-xs font-medium">
                        <span>Total de Órdenes:</span>
                        <span>${ordersTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Carrito actual */}
              {items.length > 0 && (
                <div className="border rounded-lg p-2">
                  <h3 className="font-medium text-sm mb-2">Carrito Actual</h3>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex flex-col p-1 border rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product.name}</p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">
                            ${item.product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })} x {item.quantity}
                          </p>
                          <div className="flex items-center gap-1 flex-none">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onUpdateQuantity(item.product.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1 || isProcessing}
                              className="h-6 w-6 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                onUpdateQuantity(item.product.id, parseInt(e.target.value))
                              }
                              className="w-12 h-6 text-center text-xs"
                              disabled={isProcessing}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onUpdateQuantity(item.product.id, item.quantity + 1)
                              }
                              disabled={isProcessing}
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemoveItem(item.product.id)}
                              disabled={isProcessing}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen y acciones */}
            <div className="flex-none border-t mt-2 p-2 bg-background">
              {selectedTable && currentOrders.length > 0 && (
                <div className="flex justify-between items-center mb-1 text-xs text-muted-foreground">
                  <span>Órdenes activas:</span>
                  <span>${ordersTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {items.length > 0 && (
                <div className="flex justify-between items-center mb-1 text-xs text-muted-foreground">
                  <span>Carrito actual:</span>
                  <span>${cartTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-2 text-base font-bold">
                <span>Total:</span>
                <span>${allOrdersTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={
                    items.length === 0 ||
                    (orderType === "table" && !selectedTable) ||
                    (orderType === "takeout" && !customerName.trim()) ||
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
                    orderType === "takeout" ? "Proceder al Pago" : "Enviar Orden"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      {(selectedOrderId || tempOrderId) && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false)
            setSelectedOrderId(null)
            setTempOrderId(null)
          }}
          orderId={selectedOrderId || "temp"}
          onPaymentProcessed={handlePaymentProcessed}
          isPrePayment={orderType === "takeout" && tempOrderId !== null}
          prePaymentAmount={orderType === "takeout" ? cartTotal : undefined}
        />
      )}
    </Card>
  )
}