"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChefHat,
  Grid2X2,
  Leaf,
  List,
  Package,
  RefreshCw,
  Search,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getInventoryOverview,
  getLocations,
  InventoryStockItem,
  Location,
} from "@/lib/api";
import { InventoryModificationsPanel } from "@/components/admin/inventory/inventory-modifications-panel";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_LOCATIONS = "all";
type InventoryFilter = "ALL" | "PRODUCT" | "INTERMEDIATE" | "INGREDIENT";
type StatusFilter = "ALL" | "LOW" | "OUT" | "AVAILABLE";
type InventoryView = "GRID" | "LIST";

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(
    quantity,
  );
}

function getStockStatus(item: InventoryStockItem): "OUT" | "LOW" | "AVAILABLE" {
  if (item.quantity <= 0) return "OUT";
  if (
    item.type === "INGREDIENT" &&
    item.minQuantity !== undefined &&
    item.quantity <= item.minQuantity
  ) {
    return "LOW";
  }
  return "AVAILABLE";
}

function statusLabel(status: ReturnType<typeof getStockStatus>) {
  if (status === "OUT") return "Agotado";
  if (status === "LOW") return "Stock bajo";
  return "Disponible";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function ItemIcon({ item }: { item: InventoryStockItem }) {
  if (item.type === "INGREDIENT") return <Leaf className="h-5 w-5" />;
  if (item.productKind === "INTERMEDIATE")
    return <ChefHat className="h-5 w-5" />;
  return <Package className="h-5 w-5" />;
}

function ItemKind({ item }: { item: InventoryStockItem }) {
  if (item.type === "INGREDIENT") return "Ingrediente";
  return item.productKind === "INTERMEDIATE"
    ? "Preparación intermedia"
    : "Producto terminado";
}

function StatusBadge({ item }: { item: InventoryStockItem }) {
  const status = getStockStatus(item);
  const styles = {
    OUT: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    LOW: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    AVAILABLE:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

export function InventoryManager() {
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const canManageInventory = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    user?.role ?? "",
  );
  const [items, setItems] = useState<InventoryStockItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_LOCATIONS);
  const [filter, setFilter] = useState<InventoryFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [view, setView] = useState<InventoryView>("GRID");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsItem, setDetailsItem] = useState<InventoryStockItem | null>(
    null,
  );

  const activeLocationId = isSuperAdmin
    ? selectedLocationId === ALL_LOCATIONS
      ? undefined
      : selectedLocationId
    : (user?.locationId ?? undefined);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (!isSuperAdmin && !user.locationId) {
        throw new Error("Tu usuario no tiene una sucursal asignada.");
      }
      const [stockItems, locationData] = await Promise.all([
        getInventoryOverview(activeLocationId),
        isSuperAdmin ? getLocations() : Promise.resolve([]),
      ]);
      setItems(stockItems);
      setLocations(locationData);
    } catch (loadError) {
      console.error("Error loading inventory overview:", loadError);
      const message =
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el inventario.";
      setError(message);
      toast({
        title: "No se pudo cargar el inventario",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeLocationId, isSuperAdmin, toast, user]);

  useEffect(() => {
    if (!isAuthLoading && user) void loadData();
  }, [isAuthLoading, loadData, user]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesType =
        filter === "ALL" ||
        (filter === "INGREDIENT" && item.type === "INGREDIENT") ||
        (filter === "PRODUCT" &&
          item.type === "PRODUCT" &&
          item.productKind !== "INTERMEDIATE") ||
        (filter === "INTERMEDIATE" && item.productKind === "INTERMEDIATE");
      const matchesStatus =
        statusFilter === "ALL" || getStockStatus(item) === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          item.name,
          item.code ?? "",
          item.description ?? "",
          item.unit,
          item.locationName,
          item.categoryName ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [filter, items, search, statusFilter]);

  const outOfStockCount = items.filter(
    (item) => getStockStatus(item) === "OUT",
  ).length;
  const lowStockCount = items.filter(
    (item) => getStockStatus(item) === "LOW",
  ).length;

  if (isAuthLoading || loading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Cargando existencias…
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      {isSuperAdmin && (
        <div className="w-full space-y-2 sm:max-w-sm">
          <Label htmlFor="inventory-location">Sucursal</Label>
          <Select
            value={selectedLocationId}
            onValueChange={setSelectedLocationId}
          >
            <SelectTrigger id="inventory-location">
              <SelectValue placeholder="Selecciona una sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS}>
                Todas las sucursales
              </SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void loadData()}
          >
            Reintentar
          </Button>
        </div>
      )}

      <InventoryModificationsPanel
        items={items}
        locations={locations}
        selectedLocationId={selectedLocationId}
        isSuperAdmin={isSuperAdmin}
        canManage={canManageInventory}
        assignedLocationId={user?.locationId}
        onLocationChange={setSelectedLocationId}
        onApplied={loadData}
      />

      <section
        aria-label="Resumen del inventario"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <span className="rounded-xl bg-primary/10 p-3 text-primary">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                Artículos inventariables
              </p>
              <p className="text-2xl font-semibold">{items.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <span className="rounded-xl bg-amber-500/10 p-3 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Stock bajo</p>
              <p className="text-2xl font-semibold">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <span className="rounded-xl bg-red-500/10 p-3 text-red-600">
              <Warehouse className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Agotados</p>
              <p className="text-2xl font-semibold">{outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar artículos de inventario"
              placeholder="Buscar por nombre, categoría o sede…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as InventoryFilter)}
            >
              <SelectTrigger
                aria-label="Filtrar por tipo"
                className="w-full sm:w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value="PRODUCT">Productos terminados</SelectItem>
                <SelectItem value="INTERMEDIATE">Preparaciones</SelectItem>
                <SelectItem value="INGREDIENT">Ingredientes</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger
                aria-label="Filtrar por estado"
                className="w-full sm:w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="LOW">Stock bajo</SelectItem>
                <SelectItem value="OUT">Agotados</SelectItem>
                <SelectItem value="AVAILABLE">Disponibles</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="flex rounded-lg border p-1"
              role="group"
              aria-label="Tipo de vista"
            >
              <Button
                type="button"
                variant={view === "GRID" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Vista en cuadrícula"
                aria-pressed={view === "GRID"}
                onClick={() => setView("GRID")}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={view === "LIST" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Vista en lista"
                aria-pressed={view === "LIST"}
                onClick={() => setView("LIST")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Actualizar inventario"
              onClick={() => void loadData()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
          <span>
            {visibleItems.length}{" "}
            {visibleItems.length === 1 ? "artículo" : "artículos"}
          </span>
          {isSuperAdmin && selectedLocationId === ALL_LOCATIONS && (
            <span className="inline-flex items-center gap-1">
              <Warehouse className="h-4 w-4" /> Vista de todas las sedes
            </span>
          )}
        </div>

        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center">
            <Package className="mb-3 h-9 w-9 text-muted-foreground/60" />
            <p className="font-medium">No encontramos artículos</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Prueba con otra búsqueda o cambia los filtros. Los ingredientes y
              productos aparecerán aquí.
            </p>
          </div>
        ) : view === "GRID" ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <Card
                key={`${item.type}-${item.id}`}
                className="min-w-0 overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-xl bg-muted p-3 text-foreground/80">
                        <ItemIcon item={item} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold leading-snug">
                          {item.name}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ItemKind({ item })}
                        </p>
                        {item.code && (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            Código: {item.code}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge item={item} />
                  </div>
                  <div className="rounded-xl bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Existencias actuales
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatQuantity(item.quantity)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {item.unit}
                      </span>
                    </p>
                    {item.type === "INGREDIENT" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mínimo: {formatQuantity(item.minQuantity ?? 0)}{" "}
                        {item.unit}
                      </p>
                    )}
                  </div>
                  <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {item.categoryName && <span>{item.categoryName}</span>}
                    {isSuperAdmin && (
                      <span className="font-medium text-foreground/80">
                        {item.locationName}
                      </span>
                    )}
                    {!item.isActive && (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setDetailsItem(item)}
                    >
                      Ver detalle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(125px,1fr)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)] gap-4 bg-muted/60 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:grid">
              <span>Artículo</span>
              <span>Existencias</span>
              <span>Tipo</span>
              <span>Estado</span>
              <span className="text-right">Acciones</span>
            </div>
            <div className="divide-y">
              {visibleItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid gap-3 p-3 xl:grid-cols-[minmax(220px,2fr)_minmax(125px,1fr)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)] xl:items-center xl:gap-4 xl:px-4 xl:py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-muted p-2 text-foreground/80">
                      <ItemIcon item={item} />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.categoryName ?? ItemKind({ item })}
                        {isSuperAdmin ? ` · ${item.locationName}` : ""}
                      </p>
                      {item.code && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          Código: {item.code}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold tabular-nums">
                      {formatQuantity(item.quantity)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {item.unit}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground xl:hidden">
                      {ItemKind({ item })}
                    </p>
                  </div>
                  <span className="hidden text-sm text-muted-foreground xl:block">
                    {ItemKind({ item })}
                  </span>
                  <div>
                    <StatusBadge item={item} />
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsItem(item)}
                    >
                      Detalle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={!!detailsItem}
        onOpenChange={(open) => !open && setDetailsItem(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {detailsItem && (
            <>
              <DialogHeader className="pr-7">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-muted p-3">
                    <ItemIcon item={detailsItem} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="break-words">
                      {detailsItem.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {ItemKind({ item: detailsItem })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Existencias actuales
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatQuantity(detailsItem.quantity)} {detailsItem.unit}
                    </p>
                  </div>
                  <StatusBadge item={detailsItem} />
                </div>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">Sucursal</dt>
                    <dd className="mt-1 font-medium">
                      {detailsItem.locationName}
                    </dd>
                  </div>
                  <div className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">Categoría</dt>
                    <dd className="mt-1 font-medium">
                      {detailsItem.categoryName ?? "Sin categoría"}
                    </dd>
                  </div>
                  {detailsItem.code && (
                    <div className="rounded-lg border p-3">
                      <dt className="text-xs text-muted-foreground">Código</dt>
                      <dd className="mt-1 font-mono font-medium">
                        {detailsItem.code}
                      </dd>
                    </div>
                  )}
                  {detailsItem.type === "INGREDIENT" && (
                    <div className="rounded-lg border p-3">
                      <dt className="text-xs text-muted-foreground">
                        Nivel mínimo
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatQuantity(detailsItem.minQuantity ?? 0)}{" "}
                        {detailsItem.unit}
                      </dd>
                    </div>
                  )}
                  <div className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">
                      Última actualización
                    </dt>
                    <dd className="mt-1 font-medium">
                      {formatDate(detailsItem.updatedAt)}
                    </dd>
                  </div>
                  <div className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">
                      Estado del artículo
                    </dt>
                    <dd className="mt-1 font-medium">
                      {detailsItem.isActive ? "Activo" : "Inactivo"}
                    </dd>
                  </div>
                </dl>
                {detailsItem.description && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Descripción</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {detailsItem.description}
                    </p>
                  </div>
                )}
                {(detailsItem.recipeIngredients.length > 0 ||
                  detailsItem.recipeComponents.length > 0) && (
                  <div className="space-y-3">
                    <h3 className="font-medium">Composición de la receta</h3>
                    {[
                      ...detailsItem.recipeIngredients,
                      ...detailsItem.recipeComponents,
                    ].map((line) => (
                      <div
                        key={`${detailsItem.id}-${line.id}`}
                        className="flex justify-between gap-3 border-b pb-2 text-sm last:border-0"
                      >
                        <span className="min-w-0 break-words">{line.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatQuantity(line.quantity)} {line.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
