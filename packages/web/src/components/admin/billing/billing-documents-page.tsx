"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Clock3, FileText, Loader2, RefreshCw, Search, XCircle } from "lucide-react"
import {
  listBillingDocuments,
  type BillingDocumentListItem,
  type BillingDocumentStatus,
  type BillingDocumentsResponse,
} from "@/lib/api"
import { ALL_LOCATIONS, useLocationSelection } from "@/hooks/use-location-selection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"

const PAGE_SIZE = 25
const STATUS_OPTIONS: Array<{ value: "ALL" | BillingDocumentStatus; label: string }> = [
  { value: "ALL", label: "Todos los estados" },
  { value: "ACCEPTED", label: "Emitidas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "FAILED_RETRYABLE", label: "Error reintentable" },
  { value: "RECONCILIATION_REQUIRED", label: "Requieren conciliación" },
]

export function BillingDocumentsPage() {
  const { selectedLocationId, isLoadingLocations } = useLocationSelection()
  const { toast } = useToast()
  const [filters, setFilters] = useState(() => ({
    from: getDateDaysAgo(29),
    to: bogotaToday(),
    status: "ALL" as "ALL" | BillingDocumentStatus,
    search: "",
  }))
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<BillingDocumentsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    if (isLoadingLocations) return () => { active = false }

    setIsLoading(true)
    listBillingDocuments({
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined,
      status: appliedFilters.status === "ALL" ? undefined : appliedFilters.status,
      search: appliedFilters.search.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
      ...(selectedLocationId !== ALL_LOCATIONS ? { locationId: selectedLocationId } : {}),
    })
      .then((response) => {
        if (active) setResult(response)
      })
      .catch((error: unknown) => {
        if (!active) return
        toast({
          title: "No se pudieron cargar las facturas",
          description: error instanceof Error ? error.message : "Error al consultar facturación.",
          variant: "destructive",
        })
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [appliedFilters, isLoadingLocations, page, refreshKey, selectedLocationId, toast])

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters(filters)
  }

  const counts = result?.summary.byStatus
  const attentionCount =
    (counts?.REJECTED ?? 0) +
    (counts?.FAILED_RETRYABLE ?? 0) +
    (counts?.RECONCILIATION_REQUIRED ?? 0)

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facturación electrónica</h1>
          <p className="mt-1 text-muted-foreground">
            Revisa qué documentos fueron aceptados por Factus y cuáles requieren atención.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Documentos" value={result?.summary.total} icon={<FileText className="h-4 w-4" />} />
        <SummaryCard title="Emitidas y aceptadas" value={counts?.ACCEPTED} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} />
        <SummaryCard title="Pendientes de confirmación" value={counts?.PENDING} icon={<Clock3 className="h-4 w-4 text-amber-600" />} />
        <SummaryCard title="Requieren atención" value={attentionCount} icon={<AlertCircle className="h-4 w-4 text-destructive" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos fiscales</CardTitle>
          <CardDescription>
            Solo un documento aceptado con número y CUFE se considera emitido. Los estados de solicitud del pedido no sustituyen el estado del documento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleApplyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Input
              aria-label="Desde"
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
            <Input
              aria-label="Hasta"
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
            <Select
              value={filters.status}
              onValueChange={(status: "ALL" | BillingDocumentStatus) =>
                setFilters((current) => ({ ...current, status }))
              }
            >
              <SelectTrigger aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Buscar factura o pedido"
              placeholder="N.º, cliente o pedido"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              className="lg:col-span-2"
            />
            <Button type="submit" disabled={isLoading}>
              <Search className="mr-2 h-4 w-4" />
              Aplicar filtros
            </Button>
          </form>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Factura / cliente</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Pedido(s)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : result?.items.length ? (
                  result.items.map((document) => <BillingDocumentRow key={document.id} document={document} />)
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                      No hay documentos en este periodo. Los pedidos sin solicitud de factura no aparecen aquí.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {result
                ? `Mostrando ${result.items.length} de ${result.pagination.total} documentos`
                : "Cargando documentos"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página {result?.pagination.page ?? page} de {Math.max(result?.pagination.totalPages ?? 0, 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!result || page >= result.pagination.totalPages || isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BillingDocumentRow({ document }: { document: BillingDocumentListItem }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{formatDate(document.createdAt)}</TableCell>
      <TableCell>
        <div className="font-medium">{document.documentNumber || "Sin número asignado"}</div>
        <div className="text-xs text-muted-foreground">
          {document.customerName || "Cliente"}{document.customerIdentification ? ` · ${document.customerIdentification}` : ""}
        </div>
      </TableCell>
      <TableCell>{document.locationName}</TableCell>
      <TableCell className="max-w-40 truncate font-mono text-xs">
        {document.orderIds.length ? document.orderIds.join(", ") : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(document.totalAmount)}</TableCell>
      <TableCell>
        <BillingStatusBadge status={document.status} />
        {document.errorMessage && (
          <p className="mt-1 max-w-56 truncate text-xs text-destructive" title={document.errorMessage}>
            {document.errorMessage}
          </p>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/billing/${encodeURIComponent(document.id)}`}>Ver detalle</Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function BillingStatusBadge({ status }: { status: BillingDocumentStatus }) {
  const variants = {
    ACCEPTED: { label: "Emitida", variant: "success" as const, icon: CheckCircle2 },
    PENDING: { label: "Pendiente", variant: "warning" as const, icon: Clock3 },
    REJECTED: { label: "Rechazada", variant: "destructive" as const, icon: XCircle },
    FAILED_RETRYABLE: { label: "Reintentable", variant: "warning" as const, icon: RefreshCw },
    RECONCILIATION_REQUIRED: { label: "Conciliar", variant: "destructive" as const, icon: AlertCircle },
  } satisfies Record<BillingDocumentStatus, { label: string; variant: "success" | "warning" | "destructive"; icon: typeof CheckCircle2 }>
  const statusInfo = variants[status]
  const StatusIcon = statusInfo.icon
  return (
    <Badge variant={statusInfo.variant} className="gap-1 whitespace-nowrap">
      <StatusIcon className="h-3 w-3" />
      {statusInfo.label}
    </Badge>
  )
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string
  value?: number
  icon: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value ?? "—"}</div>
      </CardContent>
    </Card>
  )
}

function formatCurrency(value: number | null): string {
  if (value === null) return "—"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value))
}

function bogotaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getDateDaysAgo(days: number): string {
  const [year, month, day] = bogotaToday().split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day - days))
  return date.toISOString().slice(0, 10)
}
