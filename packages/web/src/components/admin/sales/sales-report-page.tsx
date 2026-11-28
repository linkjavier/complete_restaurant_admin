"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  getSalesReport,
  type BillingDocumentStatus,
  type SalesReport,
} from "@/lib/api";
import {
  ALL_LOCATIONS,
  useLocationSelection,
} from "@/hooks/use-location-selection";
import { BillingStatusBadge } from "@/components/admin/billing/billing-documents-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

export function SalesReportPage() {
  const { selectedLocationId, isLoadingLocations } = useLocationSelection();
  const { toast } = useToast();
  const [dates, setDates] = useState({
    from: getDateDaysAgo(29),
    to: bogotaToday(),
  });
  const [appliedDates, setAppliedDates] = useState(dates);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (isLoadingLocations)
      return () => {
        active = false;
      };

    setIsLoading(true);
    getSalesReport({
      ...appliedDates,
      ...(selectedLocationId !== ALL_LOCATIONS
        ? { locationId: selectedLocationId }
        : {}),
    })
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast({
          title: "No se pudo cargar el reporte",
          description:
            error instanceof Error
              ? error.message
              : "Error al consultar las ventas.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedDates, isLoadingLocations, selectedLocationId, toast]);

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedDates(dates);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ventas y recaudo</h1>
          <p className="mt-1 text-muted-foreground">
            Consolida pedidos pagados, dinero cobrado y saldos pendientes, con
            desglose por sede.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/orders">
              <Receipt className="mr-2 h-4 w-4" />
              Ver pedidos
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/billing">
              <FileText className="mr-2 h-4 w-4" />
              Ver facturas
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleApply}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="space-y-1">
              <label htmlFor="sales-from" className="text-sm font-medium">
                Desde
              </label>
              <Input
                id="sales-from"
                type="date"
                value={dates.from}
                onChange={(event) =>
                  setDates((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sales-to" className="text-sm font-medium">
                Hasta
              </label>
              <Input
                id="sales-to"
                type="date"
                value={dates.to}
                onChange={(event) =>
                  setDates((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                required
              />
            </div>
            <Button
              type="submit"
              disabled={
                isLoading || isLoadingLocations || !dates.from || !dates.to
              }
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Consultar
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Periodo: fecha de creación del pedido en hora de Colombia. El
            reporte admite hasta 366 días por consulta.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Ventas pagadas"
          value={report ? formatCurrency(report.summary.salesTotal) : "—"}
          detail={
            report
              ? `${report.summary.paidOrderCount} pedidos · ${
                  report.summary.salesChangePercent === null
                    ? `periodo anterior: ${formatCurrency(report.summary.previousSalesTotal)}`
                    : `${report.summary.salesChangePercent >= 0 ? "+" : ""}${report.summary.salesChangePercent.toFixed(1)}% vs. periodo anterior`
                }`
              : "— pedidos pagados"
          }
          icon={<BarChart3 className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Dinero recaudado"
          value={report ? formatCurrency(report.summary.collectedTotal) : "—"}
          detail="Pagos completados y órdenes POS marcadas como pagadas"
          icon={<Wallet className="h-4 w-4 text-green-600" />}
        />
        <MetricCard
          title="Saldo pendiente"
          value={report ? formatCurrency(report.summary.outstandingTotal) : "—"}
          detail={`${report?.summary.unpaidOrderCount ?? "—"} pedidos sin cerrar`}
          icon={<CreditCard className="h-4 w-4 text-amber-600" />}
        />
        <MetricCard
          title="Ticket promedio"
          value={report ? formatCurrency(report.summary.averageTicket) : "—"}
          detail="Ventas pagadas ÷ pedidos pagados"
          icon={<Receipt className="h-4 w-4 text-blue-600" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por día</CardTitle>
            <CardDescription>
              Solo pedidos pagados y no cancelados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !report ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : report?.dailySales.some(({ orderCount }) => orderCount > 0) ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.dailySales}
                    margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => value.slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(value: number) => compactCurrency(value)}
                      width={78}
                    />
                    <Tooltip
                      labelFormatter={(value) => `Fecha: ${value}`}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Ventas",
                      ]}
                    />
                    <Bar
                      dataKey="sales"
                      name="Ventas"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No hay ventas pagadas en este periodo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recaudo por medio de pago</CardTitle>
            <CardDescription>
              Pagos completados, sin duplicar órdenes POS pagadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report?.paymentMethods.length ? (
              report.paymentMethods.map((payment) => {
                const maxAmount = Math.max(
                  ...report.paymentMethods.map(({ amount }) => amount),
                  1,
                );
                return (
                  <div key={payment.method} className="space-y-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{paymentMethodLabel(payment.method)}</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (payment.amount / maxAmount) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No hay pagos registrados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por ubicación</CardTitle>
            <CardDescription>
              Ventas pagadas dentro del periodo seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report?.salesByLocation.length ? (
              <div className="space-y-3">
                {report.salesByLocation.map((location) => (
                  <div
                    key={location.locationId ?? "unassigned"}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {location.locationName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {location.paidOrderCount} pedidos pagados
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(location.sales)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay ventas pagadas por ubicación en este periodo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>
              Unidades en pedidos pagados; no se usa el precio actual para
              reconstruir ventas históricas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report?.topProducts.length ? (
              <div className="space-y-3">
                {report.topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium">
                        {product.name}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {product.quantity} unidades
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay productos vendidos en este periodo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Pedidos recientes</CardTitle>
              <CardDescription>
                Consulta el estado de pago y su documento fiscal asociado.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/orders">
                Todos <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {report?.recentOrders.length ? (
              <div className="space-y-3">
                {report.recentOrders.map((order) => {
                  const document = order.billingDocuments[0];
                  return (
                    <div
                      key={order.id}
                      className="flex flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{order.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)} ·{" "}
                          {order.customerName || order.type}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(order.total ?? 0)}
                        </span>
                        {document ? (
                          <Link
                            href={`/admin/billing/${encodeURIComponent(document.id)}`}
                            aria-label={`Ver factura del pedido ${order.id}`}
                          >
                            <BillingStatusBadge status={document.status} />
                          </Link>
                        ) : order.billingRequestStatus === "REQUESTED" ? (
                          <Badge variant="warning">
                            Solicitud sin documento
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sin factura</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay pedidos en este periodo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-md border p-3 text-xs text-muted-foreground">
        <AlertCircleIcon />
        <p>
          Las ventas se calculan desde órdenes pagadas; el recaudo suma pagos
          completados y evita contar dos veces órdenes POS ya marcadas como
          pagadas. La emisión fiscal se confirma en el módulo de Facturación.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function AlertCircleIcon() {
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CREDIT_CARD: "Tarjeta de crédito",
    DEBIT_CARD: "Tarjeta débito",
    QR: "QR",
  };
  return labels[method] ?? method;
}

function bogotaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function getDateDaysAgo(days: number): string {
  const [year, month, day] = bogotaToday().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days))
    .toISOString()
    .slice(0, 10);
}
