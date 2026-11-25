"use client"

import { useEffect, useState, type FormEvent } from "react"
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react"
import {
  getBillingLocationConfiguration,
  saveBillingLocationConfiguration,
  type BillingLocationConfiguration,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface BillingFormFields {
  issuerLegalName: string
  issuerTaxId: string
  issuerTaxIdDv: string
  establishmentName: string
  establishmentAddress: string
  establishmentMunicipalityCode: string
  establishmentPhone: string
  establishmentEmail: string
  numberingRangeId: string
  factusClientId: string
  factusClientSecret: string
  factusUsername: string
  factusPassword: string
}

const EMPTY_FIELDS: BillingFormFields = {
  issuerLegalName: "",
  issuerTaxId: "",
  issuerTaxIdDv: "",
  establishmentName: "",
  establishmentAddress: "",
  establishmentMunicipalityCode: "",
  establishmentPhone: "",
  establishmentEmail: "",
  numberingRangeId: "",
  factusClientId: "",
  factusClientSecret: "",
  factusUsername: "",
  factusPassword: "",
}

interface BillingSettingsTabProps {
  locationId: string
}

export function BillingSettingsTab({ locationId }: BillingSettingsTabProps) {
  const [fields, setFields] = useState<BillingFormFields>(EMPTY_FIELDS)
  const [configuration, setConfiguration] = useState<BillingLocationConfiguration | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    setConfiguration(null)
    setFields(EMPTY_FIELDS)

    if (!locationId) {
      setIsLoading(false)
      return () => {
        cancelled = true
      }
    }

    setIsLoading(true)
    getBillingLocationConfiguration(locationId)
      .then((result) => {
        if (cancelled) return
        setConfiguration(result)
        setFields({
          issuerLegalName: result.issuerLegalName ?? "",
          issuerTaxId: result.issuerTaxId ?? "",
          issuerTaxIdDv: result.issuerTaxIdDv ?? "",
          establishmentName: result.establishmentName ?? "",
          establishmentAddress: result.establishmentAddress ?? "",
          establishmentMunicipalityCode: result.establishmentMunicipalityCode ?? "",
          establishmentPhone: result.establishmentPhone ?? "",
          establishmentEmail: result.establishmentEmail ?? "",
          numberingRangeId: result.numberingRangeId?.toString() ?? "",
          factusClientId: "",
          factusClientSecret: "",
          factusUsername: "",
          factusPassword: "",
        })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "No se pudo cargar la configuración fiscal.",
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locationId, toast])

  const updateField = (field: keyof BillingFormFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }))
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!locationId) return

    const credentialValues = [
      fields.factusClientId,
      fields.factusClientSecret,
      fields.factusUsername,
      fields.factusPassword,
    ]
    const hasCredentials = credentialValues.some((value) => value.length > 0)
    if (hasCredentials && credentialValues.some((value) => value.length === 0)) {
      toast({
        title: "Credenciales incompletas",
        description: "Para cambiar Factus, completa client ID, client secret, usuario y contraseña.",
        variant: "destructive",
      })
      return
    }

    const numberingRangeId = fields.numberingRangeId.trim()
      ? Number(fields.numberingRangeId)
      : null
    if (
      numberingRangeId !== null &&
      (!Number.isInteger(numberingRangeId) || numberingRangeId < 1)
    ) {
      toast({
        title: "Rango de numeración inválido",
        description: "Ingresa un ID de rango de numeración válido de Factus.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await saveBillingLocationConfiguration(locationId, {
        issuerLegalName: nullable(fields.issuerLegalName),
        issuerTaxId: nullable(fields.issuerTaxId),
        issuerTaxIdDv: nullable(fields.issuerTaxIdDv),
        establishmentName: nullable(fields.establishmentName),
        establishmentAddress: nullable(fields.establishmentAddress),
        establishmentMunicipalityCode: nullable(fields.establishmentMunicipalityCode),
        establishmentPhone: nullable(fields.establishmentPhone),
        establishmentEmail: nullable(fields.establishmentEmail),
        numberingRangeId,
        ...(hasCredentials
          ? {
              factusClientId: fields.factusClientId,
              factusClientSecret: fields.factusClientSecret,
              factusUsername: fields.factusUsername,
              factusPassword: fields.factusPassword,
            }
          : {}),
      })
      setConfiguration(result)
      setFields((current) => ({
        ...current,
        factusClientId: "",
        factusClientSecret: "",
        factusUsername: "",
        factusPassword: "",
      }))
      toast({
        title: "Configuración guardada",
        description: "El perfil fiscal de esta ubicación fue actualizado.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar la configuración fiscal.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!locationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facturación electrónica</CardTitle>
          <CardDescription>Selecciona una ubicación para administrar su perfil fiscal.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Facturación electrónica</CardTitle>
          <CardDescription>
            Este perfil es independiente para cada ubicación. El NIT y la cuenta de Factus deben
            corresponder al emisor legal que factura desde esta sede.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>País del emisor</Label>
              <Input value="Colombia" readOnly />
            </div>
            <div className="space-y-2">
              <Label>Proveedor y entorno</Label>
              <Input value="Factus · Sandbox" readOnly />
            </div>
          </div>

          <div
            className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
              configuration?.isReady
                ? "border-green-600/30 bg-green-500/5"
                : "border-amber-600/30 bg-amber-500/5"
            }`}
            role="status"
          >
            {configuration?.isReady ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span>
              {configuration?.isReady
                ? "Perfil completo. La emisión automática desde órdenes aún no está activada."
                : "Perfil incompleto. Puedes guardar avances; se requieren los datos fiscales, el rango y las credenciales para emitir."}
            </span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Emisor y establecimiento</CardTitle>
            <CardDescription>
              El NIT debe corresponder a la cuenta independiente de Factus configurada para esta ubicación.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="issuerLegalName"
              label="Razón social del emisor"
              value={fields.issuerLegalName}
              onChange={(value) => updateField("issuerLegalName", value)}
              disabled={isSaving}
            />
            <FormField
              id="issuerTaxId"
              label="NIT"
              value={fields.issuerTaxId}
              onChange={(value) => updateField("issuerTaxId", value)}
              disabled={isSaving}
              inputMode="numeric"
            />
            <FormField
              id="issuerTaxIdDv"
              label="Dígito de verificación"
              value={fields.issuerTaxIdDv}
              onChange={(value) => updateField("issuerTaxIdDv", value)}
              disabled={isSaving}
              inputMode="numeric"
            />
            <FormField
              id="establishmentName"
              label="Nombre del establecimiento"
              value={fields.establishmentName}
              onChange={(value) => updateField("establishmentName", value)}
              disabled={isSaving}
            />
            <FormField
              id="establishmentAddress"
              label="Dirección del establecimiento"
              value={fields.establishmentAddress}
              onChange={(value) => updateField("establishmentAddress", value)}
              disabled={isSaving}
            />
            <FormField
              id="establishmentMunicipalityCode"
              label="Código DANE del municipio"
              value={fields.establishmentMunicipalityCode}
              onChange={(value) => updateField("establishmentMunicipalityCode", value)}
              disabled={isSaving}
              inputMode="numeric"
            />
            <FormField
              id="establishmentPhone"
              label="Teléfono"
              value={fields.establishmentPhone}
              onChange={(value) => updateField("establishmentPhone", value)}
              disabled={isSaving}
              inputMode="tel"
            />
            <FormField
              id="establishmentEmail"
              label="Correo electrónico"
              type="email"
              value={fields.establishmentEmail}
              onChange={(value) => updateField("establishmentEmail", value)}
              disabled={isSaving}
            />
            <FormField
              id="numberingRangeId"
              label="ID del rango de numeración en Factus"
              type="number"
              value={fields.numberingRangeId}
              onChange={(value) => updateField("numberingRangeId", value)}
              disabled={isSaving}
              inputMode="numeric"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credenciales de Factus Sandbox</CardTitle>
            <CardDescription>
              {configuration?.credentialsConfigured
                ? "Hay credenciales cifradas guardadas. Déjalas vacías para conservarlas o completa los cuatro campos para reemplazarlas."
                : "Las cuatro credenciales son independientes para esta ubicación y se cifran antes de guardarse."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="factusClientId"
              label="Client ID"
              value={fields.factusClientId}
              onChange={(value) => updateField("factusClientId", value)}
              disabled={isSaving}
            />
            <FormField
              id="factusClientSecret"
              label="Client secret"
              type="password"
              value={fields.factusClientSecret}
              onChange={(value) => updateField("factusClientSecret", value)}
              disabled={isSaving}
            />
            <FormField
              id="factusUsername"
              label="Usuario Factus"
              value={fields.factusUsername}
              onChange={(value) => updateField("factusUsername", value)}
              disabled={isSaving}
              autoComplete="username"
            />
            <FormField
              id="factusPassword"
              label="Contraseña Factus"
              type="password"
              value={fields.factusPassword}
              onChange={(value) => updateField("factusPassword", value)}
              disabled={isSaving}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              No se muestran ni se devuelven credenciales guardadas. Para usarlas en el servidor,
              configura BILLING_CREDENTIALS_ENCRYPTION_KEY.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Guardando..." : "Guardar perfil de facturación"}
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        Esta pestaña administra los datos fiscales por ubicación. Las órdenes no generan facturas
        automáticamente todavía; la emisión Sandbox permanece como un proceso explícito. Los datos
        del establecimiento se guardan en Kutchen, pero aún no se envían en el payload de Factus.
      </p>
    </div>
  )
}

interface FormFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: string
  inputMode?: "numeric" | "tel"
  autoComplete?: string
}

function FormField({
  id,
  label,
  value,
  onChange,
  disabled,
  type = "text",
  inputMode,
  autoComplete,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  )
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}
