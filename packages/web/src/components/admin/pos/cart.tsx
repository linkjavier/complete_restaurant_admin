"use client"

import { useState } from "react"
import { Product, ProductVariant } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus, Trash2, MapPin, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { Table } from "@/lib/api"
import { PaymentDialog } from "@/components/admin/pos/payment-dialog"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProductVariantWithGroup extends ProductVariant {
  groupName?: string;
}

interface CartItem {
  product: Product
  variants?: ProductVariantWithGroup[] // Para productos con grupos de variantes
  variant?: ProductVariant   // Para productos con una sola variante
  quantity: number
}

interface CartProps {
  items: CartItem[]
  onUpdateQuantity: (key: string, quantity: number) => void
  onRemoveItem: (key: string) => void
  orderType: "table" | "takeout" | "delivery"
  selectedTable: string | null
  tables: Table[]
  onOrderTypeChange: (type: "table" | "takeout" | "delivery") => void
  onTableSelect: (tableId: string) => void
  onSubmit: (assignedLocationId?: string) => void
  loading?: boolean
  customerName: string
  onCustomerNameChange: (name: string) => void
  deliveryAddress: string
  onDeliveryAddressChange: (address: string) => void
  neighborhood: string
  onNeighborhoodChange: (neighborhood: string) => void
  phone: string
  onPhoneChange: (phone: string) => void
  paymentMethod: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "TRANSFER"
  onPaymentMethodChange: (method: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "TRANSFER") => void
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
  locations?: Location[]
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
  deliveryAddress,
  onDeliveryAddressChange,
  neighborhood,
  onNeighborhoodChange,
  phone,
  onPhoneChange,
  paymentMethod,
  onPaymentMethodChange,
  currentOrders = [],
  locations = [],
}: CartProps) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tempOrderId, setTempOrderId] = useState<string | null>(null)

  // Address validation state
  const [isValidating, setIsValidating] = useState(false)
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean | null
    distance?: number
    coords?: { lat: number; lng: number }
    assignedLocation?: Location
    error?: string
  }>({ isValid: null })

  const handleValidateAddress = async (address: string) => {
    if (!address.trim()) {
      setAddressValidation({ isValid: null })
      return
    }

    setIsValidating(true)
    try {
      const { getAuthHeaders, API_URL } = await import("@/lib/api")
      const response = await fetch(`${API_URL}/address/validate`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error al validar la dirección")
      }

      const data = await response.json()
      setAddressValidation({
        isValid: true,
        coords: data.coords,
        distance: data.distance,
        assignedLocation: data.assignedLocation,
      })
    } catch (error: any) {
      console.error("Error validating address:", error)
      setAddressValidation({
        isValid: false,
        error: error.message || "Error al validar la dirección"
      })
    } finally {
      setIsValidating(false)
    }
  }

  const cartTotal = items.reduce(
    (sum, item) => {
      // Calcular precio base del producto
      let itemPrice = item.product.price;

      // Sumar precios de variantes si existen
      if (item.variants && item.variants.length > 0) {
        const variantsPrice = item.variants.reduce((vSum, v) => vSum + (v.price || 0), 0);
        itemPrice += variantsPrice;
      } else if (item.variant) {
        itemPrice += (item.variant.price || 0);
      }

      return sum + itemPrice * item.quantity;
    },
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
        // Mesa o Domicilio: crear orden primero
        // Si es domicilio, pasar el ID de la sede asignada
        const assignedLocationId = orderType === "delivery" ? addressValidation.assignedLocation?.id : undefined;
        await onSubmit(assignedLocationId)
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
                <Button
                  variant={orderType === "delivery" ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("delivery")}
                  disabled={isProcessing}
                  size="sm"
                >
                  Domicilio
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

              {orderType === "delivery" && (
                <div className="space-y-2">
                  <Input
                    placeholder="Nombre del cliente"
                    value={customerName}
                    onChange={(e) => onCustomerNameChange(e.target.value)}
                    disabled={isProcessing}
                    className="h-8"
                  />
                  <div className="relative">
                    <Input
                      placeholder="Dirección de entrega"
                      value={deliveryAddress}
                      onChange={(e) => {
                        onDeliveryAddressChange(e.target.value)
                        setAddressValidation({ isValid: null })
                      }}
                      onBlur={(e) => handleValidateAddress(e.target.value)}
                      disabled={isProcessing}
                      className={`h-8 pr-8 ${addressValidation.isValid === true
                        ? "border-green-500 focus-visible:ring-green-500"
                        : addressValidation.isValid === false
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                        }`}
                    />
                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                      {isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : addressValidation.isValid === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : addressValidation.isValid === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {addressValidation.isValid === true && (
                    <div className="px-2 py-1 bg-green-50 border border-green-100 rounded-md space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-green-700 font-medium flex items-center gap-2">
                          <span>Coord: {addressValidation.coords?.lat.toFixed(4)}, {addressValidation.coords?.lng.toFixed(4)}</span>
                          {addressValidation.distance !== undefined && (
                            <span className="font-bold">Distancia: {addressValidation.distance.toFixed(1)} km</span>
                          )}
                        </p>
                        {addressValidation.coords && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${addressValidation.coords.lat},${addressValidation.coords.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 hover:bg-green-200 hover:text-green-900 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            Ver en Mapa
                          </a>
                        )}
                      </div>
                      {addressValidation.assignedLocation && (
                        <p className="text-[10px] text-green-800 font-bold border-t border-green-200 pt-1">
                          Sede asignada: {addressValidation.assignedLocation.name}
                        </p>
                      )}
                    </div>
                  )}

                  {addressValidation.isValid === false && (
                    <p className="text-[10px] text-red-600 font-medium px-1">
                      {addressValidation.error || "Dirección no válida o no encontrada"}
                    </p>
                  )}
                  <Input
                    placeholder="Barrio (opcional)"
                    value={neighborhood}
                    onChange={(e) => onNeighborhoodChange(e.target.value)}
                    disabled={isProcessing}
                    className="h-8"
                  />
                  <Input
                    placeholder="Teléfono"
                    value={phone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    disabled={isProcessing}
                    className="h-8"
                  />
                  <Select
                    value={paymentMethod}
                    onValueChange={(value: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "TRANSFER") => onPaymentMethodChange(value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Efectivo</SelectItem>
                      <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                      <SelectItem value="DEBIT_CARD">Tarjeta de Débito</SelectItem>
                      <SelectItem value="TRANSFER">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    {items.map((item, idx) => (
                      <div
                        key={item.product.id + (item.variant ? `__${item.variant.name}` : '')}
                        className="flex flex-col p-1 border rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product.name}</p>
                          {/* Mostrar todas las variantes seleccionadas si existen grupos de variantes */}
                          {Array.isArray(item.variants) && item.variants.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.variants.map((variant, vIdx) => (
                                <div key={vIdx} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
                                  <span className="text-xs font-semibold text-muted-foreground">{variant.groupName}:</span>
                                  <span className="text-xs font-medium">{variant.name}</span>
                                  {typeof variant.price === 'number' && !isNaN(variant.price) && (
                                    <span className="text-xs text-muted-foreground">${variant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Variante simple (sin grupo) */}
                          {item.variant && !item.variants && (
                            <div className="flex items-center gap-2 mt-1">
                              {item.variant.image && (
                                <img src={item.variant.image} alt={item.variant.name} className="w-6 h-6 object-cover rounded" />
                              )}
                              <span className="text-xs font-medium">{item.variant.name}</span>
                              {typeof item.variant.price === 'number' && !isNaN(item.variant.price) && (
                                <span className="text-xs text-muted-foreground">${item.variant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">
                            ${typeof item.variant?.price === 'number' && !isNaN(item.variant.price)
                              ? item.variant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })
                              : item.product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })
                            } x {item.quantity}
                          </p>
                          <div className="flex items-center gap-1 flex-none">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onUpdateQuantity(item.product.id + (item.variant ? `__${item.variant.name}` : ''), item.quantity - 1)
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
                                onUpdateQuantity(item.product.id + (item.variant ? `__${item.variant.name}` : ''), parseInt(e.target.value))
                              }
                              className="w-12 h-6 text-center text-xs"
                              disabled={isProcessing}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onUpdateQuantity(item.product.id + (item.variant ? `__${item.variant.name}` : ''), item.quantity + 1)
                              }
                              disabled={isProcessing}
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemoveItem(item.product.id + (item.variant ? `__${item.variant.name}` : ''))}
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
                    (orderType === "delivery" && (!customerName.trim() || !deliveryAddress.trim() || !phone.trim() || !paymentMethod)) ||
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