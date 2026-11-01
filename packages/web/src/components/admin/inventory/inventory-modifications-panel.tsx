"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  applyInventoryModification,
  countInventoryModificationItem,
  createInventoryModification,
  getInventoryModification,
  getInventoryModifications,
  InventoryModification,
  InventoryModificationItem,
  InventoryModificationSummary,
  InventoryStockItem,
  Location,
  removeInventoryModificationItem,
} from "@/lib/api";
import {
  downloadInventoryModificationPdf,
  printInventoryModification,
} from "@/components/admin/inventory/inventory-modification-report";
import { useToast } from "@/components/ui/use-toast";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface InventoryModificationsPanelProps {
  items: InventoryStockItem[];
  locations: Location[];
  selectedLocationId: string;
  isSuperAdmin: boolean;
  canManage: boolean;
  assignedLocationId?: string | null;
  onLocationChange: (locationId: string) => void;
  onApplied: () => Promise<void>;
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(
    quantity,
  );
}

function formatModificationNumber(number: number) {
  return `INV-${String(number).padStart(6, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function actorName(actor: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();
  return fullName || actor.email;
}

function Difference({ value, unit }: { value: number; unit: string }) {
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
        positive
          ? "text-emerald-700 dark:text-emerald-400"
          : negative
            ? "text-red-700 dark:text-red-400"
            : "text-muted-foreground"
      }`}
    >
      {positive ? <ArrowUp className="h-3.5 w-3.5" /> : null}
      {negative ? <ArrowDown className="h-3.5 w-3.5" /> : null}
      {formatQuantity(value)} {unit}
    </span>
  );
}

function StatusBadge({ status }: { status: "DRAFT" | "APPLIED" }) {
  return status === "DRAFT" ? (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
    >
      En progreso
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      Aplicada
    </Badge>
  );
}

export function InventoryModificationsPanel({
  items,
  locations,
  selectedLocationId,
  isSuperAdmin,
  canManage,
  assignedLocationId,
  onLocationChange,
  onApplied,
}: InventoryModificationsPanelProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<InventoryModificationSummary[]>([]);
  const [activeModification, setActiveModification] =
    useState<InventoryModification | null>(null);
  const [detailsModification, setDetailsModification] =
    useState<InventoryModification | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLocationId, setCreateLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemToCount, setItemToCount] = useState<InventoryStockItem | null>(
    null,
  );
  const [countedQuantity, setCountedQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await getInventoryModifications());
    } catch (error) {
      console.error("Error loading inventory modification history:", error);
      toast({
        title: "No se pudo cargar el historial",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canManage) void refreshHistory();
  }, [canManage, refreshHistory]);

  useEffect(() => {
    if (!showCreateDialog) return;
    setCreateLocationId(
      !isSuperAdmin
        ? assignedLocationId ?? ""
        : selectedLocationId !== ALL_LOCATIONS
          ? selectedLocationId
          : (locations[0]?.id ?? ""),
    );
    setNotes("");
  }, [
    assignedLocationId,
    isSuperAdmin,
    locations,
    selectedLocationId,
    showCreateDialog,
  ]);

  const existingLine = useMemo(() => {
    if (!activeModification || !itemToCount) return null;
    return (
      activeModification.items.find(
        (line) =>
          line.itemId === itemToCount.id && line.itemType === itemToCount.type,
      ) ?? null
    );
  }, [activeModification, itemToCount]);

  const availableItems = useMemo(() => {
    if (!activeModification) return [];
    const normalizedSearch = itemSearch.trim().toLocaleLowerCase();
    return items
      .filter((item) => item.locationId === activeModification.location.id)
      .filter(
        (item) =>
          !normalizedSearch ||
          [item.name, item.categoryName ?? "", item.unit].some((value) =>
            value.toLocaleLowerCase().includes(normalizedSearch),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [activeModification, items, itemSearch]);

  const loadModification = async (id: string) => {
    try {
      const modification = await getInventoryModification(id);
      setActiveModification(
        modification.status === "DRAFT" ? modification : null,
      );
      if (modification.status === "DRAFT") {
        onLocationChange(modification.location.id);
        setItemSearch("");
      } else {
        setDetailsModification(modification);
      }
    } catch (error) {
      console.error("Error loading inventory modification:", error);
      toast({
        title: "No se pudo abrir la modificación",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!createLocationId) {
      toast({
        title: "Selecciona una sucursal",
        description: "Cada modificación corresponde a una sola sucursal.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const modification = await createInventoryModification({
        locationId: createLocationId,
        notes: notes.trim() || undefined,
      });
      setActiveModification(modification);
      setShowCreateDialog(false);
      setItemSearch("");
      onLocationChange(modification.location.id);
      await refreshHistory();
      toast({
        title: `${formatModificationNumber(modification.number)} creada`,
        description: "Agrega los artículos y registra su conteo físico.",
      });
    } catch (error) {
      console.error("Error creating inventory modification:", error);
      toast({
        title: "No se pudo crear la modificación",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openCountDialog = (
    item: InventoryStockItem,
    line?: InventoryModificationItem,
  ) => {
    setItemToCount(item);
    setCountedQuantity(line ? String(line.countedQuantity) : "");
  };

  const saveCount = async () => {
    if (!activeModification || !itemToCount) return;
    const parsedQuantity = Number(countedQuantity);
    if (
      countedQuantity.trim() === "" ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity < 0
    ) {
      toast({
        title: "Conteo no válido",
        description:
          "Ingresa la cantidad física contada, igual o mayor que cero.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await countInventoryModificationItem(activeModification.id, {
        itemId: itemToCount.id,
        itemType: itemToCount.type,
        countedQuantity: parsedQuantity,
      });
      setActiveModification(
        await getInventoryModification(activeModification.id),
      );
      setItemToCount(null);
      toast({
        title: "Conteo guardado",
        description: `${itemToCount.name} quedó agregado a ${formatModificationNumber(activeModification.number)}.`,
      });
    } catch (error) {
      console.error("Error saving physical inventory count:", error);
      toast({
        title: "No se pudo guardar el conteo",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (line: InventoryModificationItem) => {
    if (!activeModification) return;
    try {
      await removeInventoryModificationItem(activeModification.id, line.id);
      setActiveModification(
        await getInventoryModification(activeModification.id),
      );
      toast({
        title: "Artículo retirado del conteo",
        description: line.itemName,
      });
    } catch (error) {
      console.error("Error removing inventory count line:", error);
      toast({
        title: "No se pudo retirar el artículo",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleApply = async () => {
    if (!activeModification) return;
    setSaving(true);
    try {
      const applied = await applyInventoryModification(activeModification.id);
      setActiveModification(null);
      setConfirmApply(false);
      setDetailsModification(applied);
      await Promise.all([refreshHistory(), onApplied()]);
      toast({
        title: `${formatModificationNumber(applied.number)} aplicada`,
        description:
          "Las existencias quedaron actualizadas con el conteo físico.",
      });
    } catch (error) {
      console.error("Error applying inventory modification:", error);
      toast({
        title: "No se pudo aplicar la modificación",
        description:
          error instanceof Error
            ? error.message
            : "Revisa los conteos e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReport = (modification: InventoryModification) => {
    try {
      downloadInventoryModificationPdf(modification);
    } catch (error) {
      console.error("Error generating inventory modification PDF:", error);
      toast({
        title: "No se pudo generar el PDF",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handlePrintReport = (modification: InventoryModification) => {
    try {
      printInventoryModification(modification);
    } catch (error) {
      console.error("Error printing inventory modification:", error);
      toast({
        title: "No se pudo abrir la impresión",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const openHistoryItem = async (
    modification: InventoryModificationSummary,
  ) => {
    if (modification.status === "DRAFT") {
      await loadModification(modification.id);
      return;
    }
    try {
      setDetailsModification(await getInventoryModification(modification.id));
    } catch (error) {
      console.error("Error loading inventory modification detail:", error);
      toast({
        title: "No se pudo abrir el detalle",
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  if (!canManage) return null;

  return (
    <section className="space-y-4">
      {!activeModification ? (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="rounded-xl bg-primary/10 p-3 text-primary">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">Conteos y modificaciones</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Registra lo que contaste físicamente. Revisamos la diferencia
                  y actualizamos el stock solo cuando confirmes.
                </p>
              </div>
            </div>
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva modificación
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-primary/30 shadow-sm">
          <CardHeader className="gap-3 bg-primary/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">
                  {formatModificationNumber(activeModification.number)}
                </CardTitle>
                <StatusBadge status={activeModification.status} />
              </div>
              <CardDescription>
                Conteo físico en{" "}
                <span className="font-medium text-foreground">
                  {activeModification.location.name}
                </span>
              </CardDescription>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" /> Inició{" "}
                  {actorName(activeModification.createdBy)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />{" "}
                  {formatDate(activeModification.createdAt)}
                </span>
              </div>
              {activeModification.notes && (
                <p className="text-sm text-muted-foreground">
                  {activeModification.notes}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setActiveModification(null)}
            >
              Guardar y salir
            </Button>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="space-y-3 rounded-xl border border-dashed p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-muted p-2">
                  <Search className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-medium">Agrega artículos al conteo</h3>
                  <p className="text-sm text-muted-foreground">
                    Busca por nombre y registra la cantidad que tienes
                    físicamente.
                  </p>
                </div>
              </div>
              <Input
                aria-label="Buscar artículos para agregar al conteo"
                placeholder="Buscar ingrediente, preparación o producto…"
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
              />
              {availableItems.length ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {availableItems.map((item) => {
                    const line = activeModification.items.find(
                      (countedItem) =>
                        countedItem.itemId === item.id &&
                        countedItem.itemType === item.type,
                    );
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatQuantity(item.quantity)} {item.unit} en
                            sistema
                            {line ? " · Ya contado" : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={line ? "outline" : "secondary"}
                          className="shrink-0"
                          onClick={() => openCountDialog(item, line)}
                        >
                          {line ? "Editar" : "Contar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  {items.some(
                    (item) =>
                      item.locationId === activeModification.location.id,
                  )
                    ? "No hay coincidencias. Prueba otra búsqueda."
                    : "No se cargaron artículos de esta sucursal. Actualiza el inventario para continuar."}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-semibold">Revisión de diferencias</h3>
                <p className="text-sm text-muted-foreground">
                  {activeModification.items.length
                    ? `${activeModification.items.length} ${activeModification.items.length === 1 ? "artículo contado" : "artículos contados"}`
                    : "Aún no agregas artículos a esta modificación."}
                </p>
              </div>
              {activeModification.items.length > 0 && (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => setConfirmApply(true)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Revisar y confirmar
                </Button>
              )}
            </div>

            {activeModification.items.length > 0 && (
              <div className="overflow-hidden rounded-xl border">
                <div className="hidden grid-cols-[minmax(190px,2fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(130px,1fr)_90px] gap-3 bg-muted/60 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:grid">
                  <span>Artículo</span>
                  <span>Cantidad en sistema</span>
                  <span>Conteo físico</span>
                  <span>Diferencia</span>
                  <span className="text-right">Acciones</span>
                </div>
                <div className="divide-y">
                  {activeModification.items.map((line) => (
                    <div
                      key={line.id}
                      className="grid gap-3 p-3 xl:grid-cols-[minmax(190px,2fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(130px,1fr)_90px] xl:items-center xl:gap-3 xl:px-4 xl:py-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">
                          {line.itemName}
                        </p>
                        {line.itemCode && (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            Código: {line.itemCode}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {line.itemType === "INGREDIENT"
                            ? "Ingrediente"
                            : "Producto"}{" "}
                          · {line.unit} · Conteo por {actorName(line.countedBy)}
                        </p>
                      </div>
                      <div className="flex justify-between gap-2 text-sm xl:block">
                        <span className="text-muted-foreground xl:hidden">
                          En sistema
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatQuantity(line.systemQuantity)} {line.unit}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 text-sm xl:block">
                        <span className="text-muted-foreground xl:hidden">
                          Conteo físico
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatQuantity(line.countedQuantity)} {line.unit}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 text-sm xl:block">
                        <span className="text-muted-foreground xl:hidden">
                          Diferencia
                        </span>
                        <Difference value={line.difference} unit={line.unit} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const item = items.find(
                              (entry) =>
                                entry.id === line.itemId &&
                                entry.type === line.itemType,
                            );
                            if (item) openCountDialog(item, line);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${line.itemName}`}
                          onClick={() => void removeLine(line)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!activeModification && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-5">
            <div>
              <CardTitle className="text-base">
                Historial de modificaciones
              </CardTitle>
              <CardDescription className="mt-1">
                Cada conteo conserva quién lo inició, quién lo aplicó y el
                detalle del ajuste.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Actualizar historial"
              onClick={() => void refreshHistory()}
            >
              <RefreshCw
                className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
            {history.length === 0 && !historyLoading ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <FileCheck2 className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                <p className="font-medium">Aún no hay modificaciones</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando hagas tu primer conteo, quedará registrado aquí.
                </p>
              </div>
            ) : (
              history.map((modification) => (
                <div
                  key={modification.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 rounded-lg bg-muted p-2">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {formatModificationNumber(modification.number)}
                        </p>
                        <StatusBadge status={modification.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{modification.location.name}</span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {actorName(modification.createdBy)}
                        </span>
                        <span>{formatDate(modification.createdAt)}</span>
                        <span>{modification._count.items} artículos</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => void openHistoryItem(modification)}
                  >
                    {modification.status === "DRAFT" ? (
                      <>
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        Continuar conteo
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalle
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => !saving && setShowCreateDialog(open)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pr-7">
            <DialogTitle>Nueva modificación de inventario</DialogTitle>
            <DialogDescription>
              Iniciarás un conteo físico. El inventario no cambia hasta que
              revises y confirmes las diferencias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isSuperAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="modification-location">
                  Sucursal del conteo
                </Label>
                <Select
                  value={createLocationId}
                  onValueChange={setCreateLocationId}
                >
                  <SelectTrigger id="modification-location">
                    <SelectValue placeholder="Selecciona una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                Sucursal:{" "}
                <span className="font-semibold">
                  {locations.find(
                    (location) => location.id === assignedLocationId,
                  )?.name ?? "Tu sucursal asignada"}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="modification-notes">
                Motivo o notas (opcional)
              </Label>
              <Input
                id="modification-notes"
                placeholder="Ej. Conteo semanal de cocina"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setShowCreateDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={saving || !createLocationId}
              onClick={() => void handleCreate()}
            >
              {saving ? "Creando…" : "Crear modificación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!itemToCount}
        onOpenChange={(open) => !open && !saving && setItemToCount(null)}
      >
        <DialogContent className="sm:max-w-md">
          {itemToCount && (
            <>
              <DialogHeader className="pr-7">
                <DialogTitle>
                  {existingLine ? "Editar conteo físico" : "Contar artículo"}
                </DialogTitle>
                <DialogDescription>
                  Registra lo que encontraste de{" "}
                  <span className="font-medium text-foreground">
                    {itemToCount.name}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Cantidad en el sistema
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatQuantity(
                      existingLine?.systemQuantity ?? itemToCount.quantity,
                    )}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {itemToCount.unit}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physical-count">
                    Conteo físico ({itemToCount.unit})
                  </Label>
                  <Input
                    id="physical-count"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="Escribe la cantidad que contaste"
                    value={countedQuantity}
                    onChange={(event) => setCountedQuantity(event.target.value)}
                    autoFocus
                  />
                </div>
                {countedQuantity.trim() !== "" &&
                  Number.isFinite(Number(countedQuantity)) &&
                  Number(countedQuantity) >= 0 && (
                    <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span className="text-muted-foreground">
                        Diferencia estimada
                      </span>
                      <Difference
                        value={
                          Number(countedQuantity) -
                          (existingLine?.systemQuantity ?? itemToCount.quantity)
                        }
                        unit={itemToCount.unit}
                      />
                    </div>
                  )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  La diferencia se calcula frente al saldo registrado al agregar
                  el artículo. Se aplicará solo cuando confirmes toda la
                  modificación.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => setItemToCount(null)}
                >
                  Cancelar
                </Button>
                <Button disabled={saving} onClick={() => void saveCount()}>
                  {saving ? "Guardando…" : "Guardar conteo"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmApply}
        onOpenChange={(open) => !saving && setConfirmApply(open)}
      >
        <DialogContent className="sm:max-w-lg">
          {activeModification && (
            <>
              <DialogHeader className="pr-7">
                <DialogTitle>
                  Confirmar modificación{" "}
                  {formatModificationNumber(activeModification.number)}
                </DialogTitle>
                <DialogDescription>
                  Se actualizará el inventario de{" "}
                  {activeModification.items.length} artículos en{" "}
                  {activeModification.location.name}. Esta acción quedará en el
                  historial con tu usuario y no se puede deshacer desde esta
                  pantalla.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
                {activeModification.items.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 break-words">{line.itemName}</span>
                    <Difference value={line.difference} unit={line.unit} />
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Si el stock cambió mientras contabas, no se aplicará ningún
                  ajuste parcial. Retira ese artículo, vuelve a contarlo y
                  confirma otra vez.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => setConfirmApply(false)}
                >
                  Seguir revisando
                </Button>
                <Button disabled={saving} onClick={() => void handleApply()}>
                  {saving ? "Aplicando…" : "Confirmar y ajustar stock"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailsModification}
        onOpenChange={(open) => !open && setDetailsModification(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {detailsModification && (
            <>
              <DialogHeader className="pr-7">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>
                    {formatModificationNumber(detailsModification.number)}
                  </DialogTitle>
                  <StatusBadge status={detailsModification.status} />
                </div>
                <DialogDescription>
                  {detailsModification.location.name} · Iniciada{" "}
                  {formatDate(detailsModification.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => handlePrintReport(detailsModification)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => handleDownloadReport(detailsModification)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Creada por</p>
                    <p className="mt-1 font-medium">
                      {actorName(detailsModification.createdBy)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detailsModification.createdBy.email}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Aplicada por
                    </p>
                    <p className="mt-1 font-medium">
                      {detailsModification.appliedBy
                        ? actorName(detailsModification.appliedBy)
                        : "Pendiente de aplicar"}
                    </p>
                    {detailsModification.appliedBy && (
                      <p className="text-xs text-muted-foreground">
                        {detailsModification.appliedBy.email}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Fecha de aplicación
                    </p>
                    <p className="mt-1 font-medium">
                      {detailsModification.appliedAt
                        ? formatDate(detailsModification.appliedAt)
                        : "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Motivo o notas
                    </p>
                    <p className="mt-1 font-medium">
                      {detailsModification.notes || "Sin notas"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">
                    Detalle de artículos ({detailsModification.items.length})
                  </h3>
                  {detailsModification.items.map((line) => (
                    <div
                      key={line.id}
                      className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4 sm:items-center"
                    >
                      <span className="break-words font-medium">
                        {line.itemName}
                        {line.itemCode && (
                          <small className="mt-1 block font-mono text-xs text-muted-foreground">
                            Código: {line.itemCode}
                          </small>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        Sistema: {formatQuantity(line.systemQuantity)}{" "}
                        {line.unit}
                      </span>
                      <span className="text-muted-foreground">
                        Conteo: {formatQuantity(line.countedQuantity)}{" "}
                        {line.unit}
                      </span>
                      <div className="space-y-1">
                        <Difference value={line.difference} unit={line.unit} />
                        <p className="text-xs text-muted-foreground">
                          Contó {actorName(line.countedBy)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
