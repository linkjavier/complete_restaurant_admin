"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Loader2,
  Save,
} from "lucide-react";
import {
  getBillingLocationConfiguration,
  saveBillingLocationConfiguration,
  testBillingLocationConnection,
  type BillingLocationMissingField,
  type BillingLocationConfiguration,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

interface BillingFormFields {
  issuerLegalName: string;
  issuerTaxId: string;
  issuerTaxIdDv: string;
  establishmentName: string;
  establishmentAddress: string;
  establishmentMunicipalityCode: string;
  establishmentPhone: string;
  establishmentEmail: string;
  numberingRangeId: string;
  factusClientId: string;
  factusClientSecret: string;
  factusUsername: string;
  factusPassword: string;
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
};

const MISSING_FIELD_LABELS: Record<BillingLocationMissingField, string> = {
  issuerLegalName: "Razón social del emisor",
  issuerTaxId: "NIT del emisor",
  issuerTaxIdDv: "Dígito de verificación del emisor",
  establishmentName: "Nombre del establecimiento",
  establishmentAddress: "Dirección del establecimiento",
  establishmentMunicipalityCode: "Código DANE del municipio",
  establishmentPhone: "Teléfono del establecimiento",
  establishmentEmail: "Correo del establecimiento",
  factusCredentials: "Credenciales Factus completas",
};

interface BillingSettingsTabProps {
  locationId: string;
}

export function BillingSettingsTab({ locationId }: BillingSettingsTabProps) {
  const [fields, setFields] = useState<BillingFormFields>(EMPTY_FIELDS);
  const [configuration, setConfiguration] =
    useState<BillingLocationConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setConfiguration(null);
    setFields(EMPTY_FIELDS);

    if (!locationId) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    getBillingLocationConfiguration(locationId)
      .then((result) => {
        if (cancelled) return;
        setConfiguration(result);
        setFields({
          issuerLegalName: result.issuerLegalName ?? "",
          issuerTaxId: result.issuerTaxId ?? "",
          issuerTaxIdDv: result.issuerTaxIdDv ?? "",
          establishmentName: result.establishmentName ?? "",
          establishmentAddress: result.establishmentAddress ?? "",
          establishmentMunicipalityCode:
            result.establishmentMunicipalityCode ?? "",
          establishmentPhone: result.establishmentPhone ?? "",
          establishmentEmail: result.establishmentEmail ?? "",
          numberingRangeId: result.numberingRangeId?.toString() ?? "",
          factusClientId: "",
          factusClientSecret: "",
          factusUsername: "",
          factusPassword: "",
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast({
            title: "Error",
            description:
              error instanceof Error
                ? error.message
                : "No se pudo cargar la configuración fiscal.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, toast]);

  const updateField = (field: keyof BillingFormFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleTestConnection = async () => {
    if (!locationId || !configuration?.credentialsConfigured) return;

    setIsTestingConnection(true);
    try {
      await testBillingLocationConnection(locationId);
      toast({
        title: "Conexión exitosa",
        description:
          "Factus Sandbox aceptó las credenciales de esta ubicación.",
      });
    } catch (error) {
      toast({
        title: "No se pudo conectar con Factus",
        description:
          error instanceof Error
            ? error.message
            : "Error al validar las credenciales.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!locationId) return;

    const municipalityCode = fields.establishmentMunicipalityCode.trim();
    if (municipalityCode && !/^\d{5}$/.test(municipalityCode)) {
      toast({
        title: "Código DANE inválido",
        description:
          "Ingresa el código DANE del municipio con exactamente 5 dígitos, por ejemplo 05001.",
        variant: "destructive",
      });
      return;
    }

    const credentialValues = [
      fields.factusClientId,
      fields.factusClientSecret,
      fields.factusUsername,
      fields.factusPassword,
    ];
    const hasCredentials = credentialValues.some((value) => value.length > 0);
    if (
      hasCredentials &&
      credentialValues.some((value) => value.length === 0)
    ) {
      toast({
        title: "Credenciales incompletas",
        description:
          "Para cambiar Factus, completa client ID, client secret, usuario y contraseña.",
        variant: "destructive",
      });
      return;
    }

    const numberingRangeId = fields.numberingRangeId.trim()
      ? Number(fields.numberingRangeId)
      : null;
    if (
      numberingRangeId !== null &&
      (!Number.isInteger(numberingRangeId) || numberingRangeId < 1)
    ) {
      toast({
        title: "Rango de numeración inválido",
        description: "Ingresa un ID de rango de numeración válido de Factus.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveBillingLocationConfiguration(locationId, {
        issuerLegalName: nullable(fields.issuerLegalName),
        issuerTaxId: nullable(fields.issuerTaxId),
        issuerTaxIdDv: nullable(fields.issuerTaxIdDv),
        establishmentName: nullable(fields.establishmentName),
        establishmentAddress: nullable(fields.establishmentAddress),
        establishmentMunicipalityCode: nullable(
          fields.establishmentMunicipalityCode,
        ),
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
      });
      setConfiguration(result);
      setFields((current) => ({
        ...current,
        factusClientId: "",
        factusClientSecret: "",
        factusUsername: "",
        factusPassword: "",
      }));
      toast({
        title: "Configuración guardada",
        description: "El perfil fiscal de esta ubicación fue actualizado.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuración fiscal.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!locationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facturación electrónica</CardTitle>
          <CardDescription>
            Selecciona una ubicación para administrar su perfil fiscal.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Facturación electrónica</CardTitle>
            <CardDescription>
              Este perfil es independiente para cada ubicación. El NIT y la
              cuenta de Factus deben corresponder al emisor legal que factura
              desde esta sede.
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
              <div>
                {configuration?.isReady
                  ? "Perfil completo. Puedes solicitar facturas electrónicas desde el POS."
                  : "Perfil incompleto. Puedes guardar avances; se requieren los datos fiscales y las credenciales para emitir."}
                {!!configuration?.missingFields.length && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Falta completar:{" "}
                    {configuration.missingFields
                      .map((field) => MISSING_FIELD_LABELS[field])
                      .join(", ")}
                    .
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Emisor y establecimiento</CardTitle>
              <CardDescription>
                El NIT debe corresponder a la cuenta independiente de Factus
                configurada para esta ubicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="issuerLegalName"
                label="Razón social del emisor"
                helpText="Nombre legal del responsable que emite las facturas. Consúltalo en el RUT y escríbelo tal como aparece registrado."
                value={fields.issuerLegalName}
                onChange={(value) => updateField("issuerLegalName", value)}
                disabled={isSaving}
              />
              <FormField
                id="issuerTaxId"
                label="NIT"
                helpText="NIT del emisor sin el dígito de verificación. Lo encuentras en el RUT, en la sección de identificación tributaria."
                value={fields.issuerTaxId}
                onChange={(value) => updateField("issuerTaxId", value)}
                disabled={isSaving}
                inputMode="numeric"
              />
              <FormField
                id="issuerTaxIdDv"
                label="Dígito de verificación"
                helpText="Dígito asociado al NIT (0–9 o K). Está junto al NIT en el RUT; ingrésalo separado, sin incluirlo en el campo NIT."
                value={fields.issuerTaxIdDv}
                onChange={(value) => updateField("issuerTaxIdDv", value)}
                disabled={isSaving}
                inputMode="numeric"
              />
              <FormField
                id="establishmentName"
                label="Nombre del establecimiento"
                helpText="Nombre comercial de esta sede. Consúltalo en el registro del establecimiento en Factus o usa el nombre con el que opera el negocio."
                value={fields.establishmentName}
                onChange={(value) => updateField("establishmentName", value)}
                disabled={isSaving}
              />
              <FormField
                id="establishmentAddress"
                label="Dirección del establecimiento"
                helpText="Dirección física de la sede que emitirá las facturas. Usa la dirección registrada para el establecimiento."
                value={fields.establishmentAddress}
                onChange={(value) => updateField("establishmentAddress", value)}
                disabled={isSaving}
              />
              <FormField
                id="establishmentMunicipalityCode"
                label="Código DANE del municipio"
                helpText="Código DANE de 5 dígitos del municipio donde está la sede. Búscalo en la tabla DIVIPOLA del DANE; no uses el código del departamento."
                value={fields.establishmentMunicipalityCode}
                onChange={(value) =>
                  updateField("establishmentMunicipalityCode", value)
                }
                disabled={isSaving}
                inputMode="numeric"
                maxLength={5}
                placeholder="Ej. 05001"
              />
              <FormField
                id="establishmentPhone"
                label="Teléfono"
                helpText="Teléfono de contacto de esta sede, con el que el negocio puede ser contactado."
                value={fields.establishmentPhone}
                onChange={(value) => updateField("establishmentPhone", value)}
                disabled={isSaving}
                inputMode="tel"
              />
              <FormField
                id="establishmentEmail"
                label="Correo electrónico"
                helpText="Correo de contacto del establecimiento. Usa una dirección administrada por el negocio."
                type="email"
                value={fields.establishmentEmail}
                onChange={(value) => updateField("establishmentEmail", value)}
                disabled={isSaving}
              />
              <FormField
                id="numberingRangeId"
                label="ID del rango de numeración (opcional)"
                helpText="Factus usa automáticamente el único rango activo si solo tienes uno. Si tienes varios rangos activos para facturas, ingresa aquí el ID del rango de venta de Factus Sandbox; no uses el ID de nómina, el prefijo ni la resolución."
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
                helpText="Identificador de la aplicación para Factus Sandbox. Lo obtienes en Factus, en las credenciales de integración/API. No es tu usuario de Factus."
                value={fields.factusClientId}
                onChange={(value) => updateField("factusClientId", value)}
                disabled={isSaving}
              />
              <FormField
                id="factusClientSecret"
                label="Client secret"
                helpText="Secreto asociado al Client ID de la integración de Factus Sandbox. Se obtiene junto al Client ID y debe mantenerse privado."
                type="password"
                value={fields.factusClientSecret}
                onChange={(value) => updateField("factusClientSecret", value)}
                disabled={isSaving}
              />
              <FormField
                id="factusUsername"
                label="Usuario Factus"
                helpText="Correo electrónico del usuario de Factus Sandbox que se autenticará para emitir, tal como está registrado en Factus. No es el Client ID ni tu usuario de Kutchen."
                type="email"
                value={fields.factusUsername}
                onChange={(value) => updateField("factusUsername", value)}
                disabled={isSaving}
                autoComplete="username"
              />
              <FormField
                id="factusPassword"
                label="Contraseña Factus"
                helpText="Contraseña de la cuenta Factus Sandbox correspondiente al usuario anterior. No es el Client secret."
                type="password"
                value={fields.factusPassword}
                onChange={(value) => updateField("factusPassword", value)}
                disabled={isSaving}
                autoComplete="new-password"
              />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                <p>
                  No se muestran ni se devuelven credenciales guardadas. Para
                  usarlas en el servidor, configura
                  BILLING_CREDENTIALS_ENCRYPTION_KEY.
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Ayuda: clave de cifrado"
                      className="shrink-0 rounded-full transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CircleHelp className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs leading-relaxed">
                    Es una clave interna de Kutchen, no la entrega Factus. El
                    administrador del servidor la genera una sola vez (por
                    ejemplo, con openssl rand -base64 32) y la configura en el
                    entorno del API. Debe mantenerse estable: cambiarla puede
                    impedir descifrar credenciales ya guardadas.
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!configuration?.credentialsConfigured && (
              <p className="text-xs text-muted-foreground">
                Guarda las credenciales de Factus antes de probar la conexión.
              </p>
            )}
            {configuration?.credentialsConfigured && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isSaving || isTestingConnection}
              >
                {isTestingConnection ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {isTestingConnection
                  ? "Probando..."
                  : "Probar conexión con Factus"}
              </Button>
            )}
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
          Esta pestaña administra los datos fiscales por ubicación. Las órdenes
          no generan facturas automáticamente todavía; la emisión Sandbox
          permanece como un proceso explícito. Los datos del establecimiento se
          guardan en Kutchen, pero aún no se envían en el payload de Factus.
        </p>
      </div>
    </TooltipProvider>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  helpText: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
}

function FormField({
  id,
  label,
  helpText,
  value,
  onChange,
  disabled,
  type = "text",
  inputMode,
  autoComplete,
  maxLength,
  placeholder,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Ayuda: ${label}`}
              className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs leading-relaxed">
            {helpText}
          </TooltipContent>
        </Tooltip>
      </div>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}
