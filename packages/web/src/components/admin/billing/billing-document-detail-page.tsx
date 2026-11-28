"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  BillingRequestError,
  getBillingDocument,
  refreshPosInvoice,
  retryPosInvoice,
  type BillingDocumentDetail,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { BillingStatusBadge } from "./billing-documents-page";

export function BillingDocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { toast } = useToast();
  const [document, setDocument] = useState<BillingDocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    try {
      setDocument(await getBillingDocument(documentId));
    } catch (error) {
      toast({
        title: "No se pudo cargar el documento",
        description:
          error instanceof Error
            ? error.message
            : "Error al consultar la factura.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [documentId, toast]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const handleRetry = async () => {
    if (!document || document.status !== "FAILED_RETRYABLE") return;
    setIsRetrying(true);
    try {
      const result = await retryPosInvoice(document.id);
      toast({
        title:
          result.status === "ACCEPTED"
            ? "Factura emitida"
            : "Solicitud procesada",
        description: result.documentNumber
          ? `Número de factura: ${result.documentNumber}`
          : `Estado actual: ${result.status}`,
      });
      await loadDocument();
    } catch (error) {
      const details =
        error instanceof BillingRequestError && error.billingDocumentId
          ? `Documento ${error.billingDocumentId} · ${error.billingStatus ?? "sin confirmar"} · `
          : "";
      toast({
        title: "No se pudo reintentar la factura",
        description: `${details}${error instanceof Error ? error.message : "Error desconocido."}`,
        variant: "destructive",
      });
      await loadDocument();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRefresh = async () => {
    if (
      !document ||
      !["PENDING", "FAILED_RETRYABLE", "RECONCILIATION_REQUIRED"].includes(
        document.status,
      )
    )
      return;
    setIsRefreshing(true);
    try {
      const result = await refreshPosInvoice(document.id);
      toast({
        title:
          result.status === "ACCEPTED"
            ? "Factura confirmada en Factus"
            : "Estado consultado",
        description: result.documentNumber
          ? `Número de factura: ${result.documentNumber}`
          : `Estado actual: ${result.status}`,
      });
      await loadDocument();
    } catch (error) {
      const details =
        error instanceof BillingRequestError && error.billingDocumentId
          ? `Documento ${error.billingDocumentId} · ${error.billingStatus ?? "sin confirmar"} · `
          : "";
      toast({
        title: "No se pudo consultar Factus",
        description: `${details}${error instanceof Error ? error.message : "Error desconocido."}`,
        variant: "destructive",
      });
      await loadDocument();
    } finally {
      setIsRefreshing(false);
    }
  };

  const invoice = readRecord(document?.requestPayload);
  const customer = readRecord(invoice?.customer);
  const items = readRecords(invoice?.items);
  const payments = readRecords(invoice?.paymentDetails);
  const orderIds = document?.orderIds ?? [];

  if (isLoading && !document) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Button variant="outline" asChild>
          <Link href="/admin/billing">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a facturas
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            No fue posible cargar este documento. Puede que no exista o no
            pertenezca a tu ubicación.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            asChild
            aria-label="Volver a facturas"
          >
            <Link href="/admin/billing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">
              Detalle de factura
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {document.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void loadDocument()}
            disabled={isLoading || isRetrying || isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Actualizar estado
          </Button>
          {["PENDING", "FAILED_RETRYABLE", "RECONCILIATION_REQUIRED"].includes(
            document.status,
          ) && (
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading || isRetrying}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isRefreshing ? "Consultando Factus..." : "Consultar Factus"}
            </Button>
          )}
          {document.status === "FAILED_RETRYABLE" && (
            <Button
              onClick={handleRetry}
              disabled={isRetrying || isLoading || isRefreshing}
            >
              {isRetrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isRetrying ? "Reintentando..." : "Reintentar emisión"}
            </Button>
          )}
        </div>
      </div>

      {document.status === "RECONCILIATION_REQUIRED" && (
        <div
          className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">
              Confirma el resultado en Factus antes de volver a emitir.
            </p>
            <p className="mt-1 text-muted-foreground">
              La respuesta del proveedor no permitió confirmar si el documento
              fue creado. No se ofrece reintento automático para evitar
              duplicados.
            </p>
          </div>
        </div>
      )}
      {document.errorMessage && (
        <div
          className="flex gap-3 rounded-md border border-amber-600/30 bg-amber-500/5 p-4 text-sm"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">
              {document.errorCode || "Detalle de respuesta"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {document.errorMessage}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Estado"
          value={<BillingStatusBadge status={document.status} />}
        />
        <InfoCard
          label="Número de factura"
          value={document.documentNumber || "Aún no asignado"}
        />
        <InfoCard label="Total" value={formatCurrency(document.totalAmount)} />
        <InfoCard label="Ubicación" value={document.locationName} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del documento</CardTitle>
            <CardDescription>
              Referencia del sistema y respuesta de Factus.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Cliente"
              value={
                readString(customer?.names) ??
                readString(customer?.company) ??
                "Consumidor final"
              }
            />
            <DetailField
              label="Identificación"
              value={readString(customer?.identification) ?? "—"}
            />
            <DetailField label="Proveedor" value={document.providerName} />
            <DetailField
              label="Fecha de solicitud"
              value={formatDate(document.createdAt)}
            />
            <DetailField
              label="Referencia de Kutchen"
              value={document.referenceCode}
              mono
            />
            <DetailField
              label="Referencia de Factus"
              value={document.providerReferenceId ?? "—"}
              mono
            />
            <div className="sm:col-span-2">
              <DetailField
                label="CUFE"
                value={
                  document.cufe ?? "Disponible cuando Factus valide la factura"
                }
                mono
                breakAll
              />
            </div>
            {readString(customer?.email) && (
              <DetailField
                label="Correo del cliente"
                value={readString(customer?.email) ?? ""}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos y pagos vinculados</CardTitle>
            <CardDescription>
              La factura puede corresponder a uno o varios pedidos o pagos de
              mesa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderIds.length ? (
              <div className="flex flex-wrap gap-2">
                {orderIds.map((orderId) => (
                  <Badge key={orderId} variant="outline" className="font-mono">
                    {orderId}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay pedidos asociados.
              </p>
            )}
            {document.payments.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Pagos aplicados</p>
                {document.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span>
                      {payment.method} · {payment.orderId}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de líneas</CardTitle>
          <CardDescription>
            Valores enviados en la solicitud guardada de facturación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto / servicio</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">
                      Precio unitario
                    </TableHead>
                    <TableHead>Impuestos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const taxes = readRecords(item.taxes);
                    return (
                      <TableRow
                        key={`${readString(item.codeReference) ?? "line"}-${index}`}
                      >
                        <TableCell className="font-medium">
                          {readString(item.name) ?? "Artículo"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {readString(item.codeReference) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {readString(item.quantity) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(readNumber(item.unitPrice))}
                        </TableCell>
                        <TableCell>
                          {taxes.length
                            ? taxes.map((tax, taxIndex) => (
                                <span key={taxIndex} className="mr-1 text-xs">
                                  {readString(tax.code)} ·{" "}
                                  {readString(tax.rate)}%
                                </span>
                              ))
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se guardaron líneas en la solicitud.
            </p>
          )}
          {payments.length > 0 && (
            <div className="mt-4 flex justify-end border-t pt-4 text-lg font-semibold">
              Total enviado: {formatCurrency(document.totalAmount)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="text-lg font-semibold">{value}</CardContent>
    </Card>
  );
}

function DetailField({
  label,
  value,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`${mono ? "font-mono text-xs" : "text-sm"} ${breakAll ? "break-all" : "break-words"}`}
      >
        {value}
      </p>
    </div>
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const record = readRecord(entry);
        return record ? [record] : [];
      })
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}
