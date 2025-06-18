"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { PaymentMethod, processPayment, getOrderPaymentDetails } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  onPaymentProcessed?: () => void
  isPrePayment?: boolean
  prePaymentAmount?: number
}

export function PaymentDialog({
  isOpen,
  onClose,
  orderId,
  onPaymentProcessed,
  isPrePayment = false,
  prePaymentAmount = 0,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      if (isPrePayment) {
        // Para pre-pagos, usar el monto del carrito
        setPaymentDetails({
          totalAmount: prePaymentAmount,
          paidAmount: 0,
          remainingBalance: prePaymentAmount,
          orderStatus: "PENDING",
          payments: []
        })
        setAmount(prePaymentAmount.toString())
        setIsLoading(false)
      } else if (orderId) {
        // Para pagos normales, cargar detalles de la orden
        loadPaymentDetails()
      }
    }
  }, [isOpen, orderId, isPrePayment, prePaymentAmount])

  const loadPaymentDetails = async () => {
    try {
      setIsLoading(true)
      const details = await getOrderPaymentDetails(orderId)
      setPaymentDetails(details)
      setAmount(details.remainingBalance.toString())
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar los detalles del pago",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePayment = async () => {
    try {
      setIsProcessing(true)
      if (isPrePayment) {
        // Para pre-pagos, solo notificar que el pago fue procesado
        // La orden se creará después
        if (onPaymentProcessed) {
          onPaymentProcessed()
        }
        onClose()
      } else {
        // Proceso normal de pago para órdenes existentes
        await processPayment(orderId, parseFloat(amount), paymentMethod)
        await loadPaymentDetails()
        if (onPaymentProcessed) {
          onPaymentProcessed()
        }
        if (paymentDetails && parseFloat(amount) >= paymentDetails.remainingBalance) {
          onClose()
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al procesar el pago",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!paymentDetails || isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargando Detalles del Pago</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isPrePayment ? "Procesar Pago - Para Llevar" : "Procesar Pago"}</DialogTitle>
          <DialogDescription>
            {isPrePayment 
              ? "Por favor, realice el pago para proceder con su orden" 
              : `Ingrese los detalles del pago para la orden #${orderId}`}
          </DialogDescription>
        </DialogHeader>

        {!isPrePayment && paymentDetails.orderStatus !== "COMPLETED" && 
         paymentDetails.orderStatus !== "DELIVERED" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Atención</AlertTitle>
            <AlertDescription>
              Esta orden aún no está completada. ¿Está seguro de procesar el pago?
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Total:</div>
                <div className="text-right">${paymentDetails.totalAmount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                {!isPrePayment && (
                  <>
                    <div>Pagado hasta ahora:</div>
                    <div className="text-right">${paymentDetails.paidAmount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                  </>
                )}
                <div>Saldo Pendiente:</div>
                <div className="text-right font-bold">
                  ${paymentDetails.remainingBalance.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </CardContent>
          </Card>

          {!isPrePayment && paymentDetails.payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Pagos Realizados:</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {paymentDetails.payments.map((payment: any) => (
                  <div
                    key={payment.id}
                    className="text-sm border rounded p-2 flex justify-between"
                  >
                    <span>
                      {new Date(payment.createdAt).toLocaleString()} - {payment.method}
                    </span>
                    <span className="font-medium">${payment.amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <label>Método de Pago</label>
            <Select onValueChange={(value: PaymentMethod) => setPaymentMethod(value)} defaultValue={paymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                <SelectItem value="DEBIT_CARD">Tarjeta de Débito</SelectItem>
                <SelectItem value="QR">Pago QR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handlePayment}
            disabled={
              isProcessing ||
              !paymentMethod
            }
          >
            {isProcessing ? "Procesando..." : "Procesar Pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
