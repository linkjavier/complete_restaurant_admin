"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { BillingCustomerInput } from "@/lib/api"

interface InvoiceCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (customer: BillingCustomerInput | null) => void
}

export function InvoiceCustomerDialog({
  open,
  onOpenChange,
  onConfirm,
}: InvoiceCustomerDialogProps) {
  const [invoiceChoice, setInvoiceChoice] = useState<"electronic" | "receipt" | null>(null)
  const [documentCode, setDocumentCode] = useState("13")
  const [identification, setIdentification] = useState("222222222222")
  const [legalOrganizationCode, setLegalOrganizationCode] = useState("2")
  const [names, setNames] = useState("Consumidor final")
  const [company, setCompany] = useState("")
  const [dv, setDv] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (open) {
      setInvoiceChoice(null)
      setDocumentCode("13")
      setIdentification("222222222222")
      setLegalOrganizationCode("2")
      setNames("Consumidor final")
      setCompany("")
      setDv("")
      setEmail("")
    }
  }, [open])

  const customerName = legalOrganizationCode === "1" ? company.trim() : names.trim()
  const canConfirm =
    invoiceChoice !== null &&
    (invoiceChoice === "receipt" ||
      (documentCode.length > 0 && identification.trim().length > 0 && customerName.length > 0))

  const handleConfirm = () => {
    if (!canConfirm) return
    if (invoiceChoice === "receipt") {
      onConfirm(null)
      return
    }
    onConfirm({
      identificationDocumentCode: documentCode,
      identification: identification.trim(),
      legalOrganizationCode,
      ...(legalOrganizationCode === "1" ? { company: company.trim() } : { names: names.trim() }),
      ...(documentCode === "31" && dv.trim() ? { dv: dv.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Deseas factura electrónica?</DialogTitle>
          <DialogDescription>
            Puedes continuar con el recibo normal o ingresar los datos del cliente para solicitarla a Factus.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={invoiceChoice === "receipt" ? "default" : "outline"}
            onClick={() => setInvoiceChoice("receipt")}
          >
            Recibo normal
          </Button>
          <Button
            type="button"
            variant={invoiceChoice === "electronic" ? "default" : "outline"}
            onClick={() => setInvoiceChoice("electronic")}
          >
            Factura electrónica
          </Button>
        </div>

        {invoiceChoice === "electronic" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={documentCode} onValueChange={setDocumentCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="13">Cédula de ciudadanía</SelectItem>
                    <SelectItem value="31">NIT</SelectItem>
                    <SelectItem value="22">Cédula de extranjería</SelectItem>
                    <SelectItem value="41">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-identification">Número de identificación</Label>
                <Input
                  id="invoice-identification"
                  required
                  value={identification}
                  onChange={(event) => setIdentification(event.target.value)}
                />
              </div>
            </div>

            {documentCode === "31" && (
              <div className="space-y-2">
                <Label htmlFor="invoice-dv">Dígito de verificación (opcional)</Label>
                <Input
                  id="invoice-dv"
                  maxLength={1}
                  value={dv}
                  onChange={(event) => setDv(event.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de persona</Label>
              <Select value={legalOrganizationCode} onValueChange={setLegalOrganizationCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Persona natural</SelectItem>
                  <SelectItem value="1">Persona jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-customer-name">
                {legalOrganizationCode === "1" ? "Razón social" : "Nombre completo"}
              </Label>
              <Input
                id="invoice-customer-name"
                required
                value={legalOrganizationCode === "1" ? company : names}
                onChange={(event) =>
                  legalOrganizationCode === "1"
                    ? setCompany(event.target.value)
                    : setNames(event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-email">Correo electrónico (opcional)</Label>
              <Input
                id="invoice-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
