"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActiveOrder,
  BillingCustomerInput,
  PaymentMethod,
  declinePosTablePaymentInvoice,
  issuePosTablePaymentInvoice,
  settlePosTableAccount,
  TableSettlementParticipant,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { InvoiceCustomerDialog } from "@/components/admin/pos/invoice-customer-dialog";
import { Loader2, Minus, Plus, UserRound, Users } from "lucide-react";

interface ParticipantDraft {
  id: string;
  label: string;
  method: PaymentMethod;
  allocations: Record<string, number>;
  status: "READY" | "PAID";
  paidAmount?: number;
  paymentIds?: string[];
  billingRequestStatus?: "NOT_REQUESTED" | "REQUESTED" | "DECLINED";
}

interface TableSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  orders: ActiveOrder[];
  onSettled: () => Promise<void>;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "CREDIT_CARD", label: "Tarjeta de crédito" },
  { value: "DEBIT_CARD", label: "Tarjeta débito" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "QR", label: "QR / billetera digital" },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);

const createParticipant = (number: number): ParticipantDraft => ({
  id: `participant-${number}`,
  label: `Comensal ${number}`,
  method: "CASH",
  allocations: {},
  status: "READY",
});

const getOrderTotal = (order: ActiveOrder) =>
  order.total ??
  order.items.reduce(
    (total, item) => total + (item.price ?? item.product.price) * item.quantity,
    0,
  );

const getPaidAmount = (order: ActiveOrder) =>
  order.payments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((total, payment) => total + payment.amount, 0);

const getRemainingAmount = (order: ActiveOrder) =>
  Math.max(0, getOrderTotal(order) - getPaidAmount(order));

const getPriorAllocatedQuantity = (order: ActiveOrder, orderItemId: string) =>
  order.payments
    .filter((payment) => payment.status === "COMPLETED")
    .flatMap((payment) => payment.allocations ?? [])
    .filter((allocation) => allocation.orderItemId === orderItemId)
    .reduce((total, allocation) => total + allocation.quantity, 0);

const hasUnallocatedPriorPayment = (order: ActiveOrder) =>
  !order.isPaid &&
  order.payments.some(
    (payment) =>
      payment.status === "COMPLETED" &&
      (!Array.isArray(payment.allocations) || payment.allocations.length === 0),
  );

export function TableSettlementDialog({
  open,
  onOpenChange,
  tableId,
  orders: tableOrders,
  onSettled,
}: TableSettlementDialogProps) {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    createParticipant(1),
  ]);
  const [selectedParticipantId, setSelectedParticipantId] =
    useState("participant-1");
  const [fullPaymentMethod, setFullPaymentMethod] =
    useState<PaymentMethod>("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [splitStep, setSplitStep] = useState<"assign" | "collect">("assign");
  const [activeTab, setActiveTab] = useState("full");
  const [isPayerInvoiceDialogOpen, setIsPayerInvoiceDialogOpen] =
    useState(false);
  const [pendingInvoiceParticipantId, setPendingInvoiceParticipantId] =
    useState<string | null>(null);
  const [payerInvoiceFlow, setPayerInvoiceFlow] = useState<"PAY" | "DECIDE">(
    "PAY",
  );
  const orders = useMemo(
    () => tableOrders.filter((order) => order.status !== "CANCELLED"),
    [tableOrders],
  );
  const hasSplitPayments = orders.some((order) =>
    order.payments.some(
      (payment) =>
        Array.isArray(payment.allocations) && payment.allocations.length > 0,
    ),
  );

  useEffect(() => {
    if (!open) return;
    setParticipants([createParticipant(1)]);
    setSelectedParticipantId("participant-1");
    setFullPaymentMethod("CASH");
    setSplitStep("assign");
    setActiveTab("full");
    setIsPayerInvoiceDialogOpen(false);
    setPendingInvoiceParticipantId(null);
    setPayerInvoiceFlow("PAY");
  }, [open]);

  useEffect(() => {
    if (open && hasSplitPayments) setActiveTab("split");
  }, [open, hasSplitPayments]);

  const pendingTotal = useMemo(
    () => orders.reduce((total, order) => total + getRemainingAmount(order), 0),
    [orders],
  );

  const assignedTotal = useMemo(
    () =>
      participants.reduce((total, participant) => {
        if (participant.status === "PAID") return total;
        const participantTotal = orders.reduce((orderSum, order) => {
          const itemTotal = order.items.reduce((sum, item) => {
            const quantity = participant.allocations[item.id] ?? 0;
            return sum + quantity * (item.price ?? item.product.price);
          }, 0);
          return orderSum + itemTotal;
        }, 0);
        return total + participantTotal;
      }, 0),
    [orders, participants],
  );
  const unpaidParticipants = participants.filter(
    (participant) =>
      participant.status === "READY" &&
      Object.keys(participant.allocations).length > 0,
  );
  const participantsWithPendingBilling = participants.filter(
    (participant) =>
      participant.status === "PAID" &&
      participant.billingRequestStatus === "NOT_REQUESTED" &&
      Boolean(participant.paymentIds?.length),
  );
  const paidTotal = participants.reduce(
    (total, participant) => total + (participant.paidAmount ?? 0),
    0,
  );

  const getParticipantTotal = (participant: ParticipantDraft) =>
    orders.reduce(
      (total, order) =>
        total +
        order.items.reduce(
          (sum, item) =>
            sum +
            (participant.allocations[item.id] ?? 0) *
              (item.price ?? item.product.price),
          0,
        ),
      0,
    );

  const addParticipant = () => {
    const participant = createParticipant(participants.length + 1);
    setParticipants((current) => [...current, participant]);
    setSelectedParticipantId(participant.id);
  };

  const updateParticipant = (
    participantId: string,
    update: (participant: ParticipantDraft) => ParticipantDraft,
  ) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === participantId ? update(participant) : participant,
      ),
    );
  };

  const changeAllocation = (
    order: ActiveOrder,
    orderItemId: string,
    delta: number,
  ) => {
    const participant = participants.find(
      ({ id }) => id === selectedParticipantId,
    );
    const item = order.items.find(({ id }) => id === orderItemId);
    if (!participant || !item || participant.status === "PAID") return;

    const currentQuantity = participant.allocations[orderItemId] ?? 0;
    if (delta > 0) {
      const alreadyAssigned = participants.reduce(
        (sum, current) =>
          sum +
          (current.status === "READY"
            ? (current.allocations[orderItemId] ?? 0)
            : 0),
        0,
      );
      const available =
        order.isPaid || getRemainingAmount(order) <= 0
          ? 0
          : Math.max(
              0,
              item.quantity - getPriorAllocatedQuantity(order, orderItemId),
            );
      if (alreadyAssigned >= available) return;
    }

    updateParticipant(participant.id, (current) => {
      const nextQuantity = Math.max(0, currentQuantity + delta);
      const allocations = { ...current.allocations };
      if (nextQuantity === 0) delete allocations[orderItemId];
      else allocations[orderItemId] = nextQuantity;
      return { ...current, allocations };
    });
  };

  const finishSettlement = async () => {
    onOpenChange(false);
    try {
      await onSettled();
    } catch (error) {
      toast({
        title: "Pago registrado; no se actualizó la cuenta",
        description:
          error instanceof Error
            ? error.message
            : "Actualiza la mesa para ver el nuevo saldo.",
        variant: "destructive",
      });
    }
  };

  const submitFullAccount = async () => {
    setIsSubmitting(true);
    try {
      await settlePosTableAccount(tableId, {
        mode: "FULL",
        method: fullPaymentMethod,
      });
      toast({
        title: "Cuenta cobrada",
        description: "Se registró el saldo de la mesa en un solo cobro.",
      });
      await finishSettlement();
    } catch (error) {
      toast({
        title: "No se pudo cobrar la cuenta",
        description:
          error instanceof Error ? error.message : "Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueToCollection = () => {
    const selectedParticipants: TableSettlementParticipant[] =
      unpaidParticipants.map((participant) => ({
        label: participant.label.trim(),
        method: participant.method,
        allocations: Object.entries(participant.allocations).map(
          ([orderItemId, quantity]) => ({ orderItemId, quantity }),
        ),
      }));
    if (selectedParticipants.length === 0) {
      toast({
        title: "Asigna productos",
        description:
          "Selecciona un comensal y asígnale los productos que va a pagar.",
        variant: "destructive",
      });
      return;
    }
    if (selectedParticipants.some(({ label }) => !label)) {
      toast({
        title: "Completa los nombres",
        description: "Cada cuenta debe tener un nombre o número.",
        variant: "destructive",
      });
      return;
    }

    setSplitStep("collect");
    setActiveTab("split");
  };

  const finishSplitCollection = async () => {
    onOpenChange(false);
    if (pendingTotal > 0) {
      toast({
        title: "División guardada",
        description: `Quedan ${formatCurrency(pendingTotal)} pendientes; puedes cobrarlos después desde la cuenta de la mesa.`,
      });
      return;
    }
    toast({
      title: "Todos los comensales pagaron",
      description: "Puedes cerrar la cuenta y liberar la mesa desde el POS.",
    });
  };

  const openPayerInvoiceDialog = (
    participantId: string,
    flow: "PAY" | "DECIDE",
  ) => {
    setPendingInvoiceParticipantId(participantId);
    setPayerInvoiceFlow(flow);
    setIsPayerInvoiceDialogOpen(true);
  };

  const refreshAfterPayerAction = async () => {
    try {
      await onSettled();
    } catch (error) {
      toast({
        title: "No se actualizó la cuenta",
        description:
          error instanceof Error
            ? error.message
            : "Actualiza la mesa para ver el estado del comprobante.",
        variant: "destructive",
      });
    }
  };

  const decideExistingPaymentInvoice = async (
    participantId: string,
    customer: BillingCustomerInput | null,
  ) => {
    const participant = participants.find(({ id }) => id === participantId);
    if (!participant?.paymentIds?.length) return;

    setIsSubmitting(true);
    try {
      if (customer) {
        await issuePosTablePaymentInvoice(
          tableId,
          participant.paymentIds,
          customer,
        );
        updateParticipant(participantId, (current) => ({
          ...current,
          billingRequestStatus: "REQUESTED",
        }));
        toast({
          title: `Factura individual de ${participant.label} solicitada`,
          description: "No se realizó un cobro adicional.",
        });
      } else {
        await declinePosTablePaymentInvoice(tableId, participant.paymentIds);
        updateParticipant(participantId, (current) => ({
          ...current,
          billingRequestStatus: "DECLINED",
        }));
        toast({
          title: `Recibo normal registrado para ${participant.label}`,
          description: "No se realizó un cobro adicional.",
        });
      }
      await refreshAfterPayerAction();
    } catch (error) {
      toast({
        title: `No se pudo registrar el comprobante de ${participant.label}`,
        description:
          error instanceof Error ? error.message : "Inténtalo nuevamente.",
        variant: "destructive",
      });
      await refreshAfterPayerAction();
    } finally {
      setIsSubmitting(false);
    }
  };

  const payParticipant = async (
    participantId: string,
    customer: BillingCustomerInput | null,
  ) => {
    const participant = participants.find(({ id }) => id === participantId);
    if (!participant || participant.status === "PAID") return;
    const allocations = Object.entries(participant.allocations).map(
      ([orderItemId, quantity]) => ({ orderItemId, quantity }),
    );
    if (allocations.length === 0) return;

    const amount = orders.reduce(
      (total, order) =>
        total +
        order.items.reduce(
          (sum, item) =>
            sum +
            (participant.allocations[item.id] ?? 0) *
              (item.price ?? item.product.price),
          0,
        ),
      0,
    );

    setIsSubmitting(true);
    try {
      const settlement = await settlePosTableAccount(tableId, {
        mode: "SPLIT",
        participants: [
          {
            label: participant.label.trim(),
            method: participant.method,
            allocations,
            invoiceChoice: customer ? "ELECTRONIC" : "RECEIPT",
          },
        ],
      });
      const paymentIds = settlement.payments.map(({ id }) => id);
      if (paymentIds.length === 0) {
        throw new Error(
          "El pago se registró sin devolver los identificadores necesarios para emitir la factura.",
        );
      }
      updateParticipant(participantId, (current) => ({
        ...current,
        status: "PAID",
        paidAmount: amount,
        paymentIds,
        billingRequestStatus: customer ? "NOT_REQUESTED" : "DECLINED",
      }));
      if (selectedParticipantId === participantId) {
        const nextParticipant = participants.find(
          (candidate) =>
            candidate.id !== participantId && candidate.status === "READY",
        );
        if (nextParticipant) setSelectedParticipantId(nextParticipant.id);
      }
      toast({
        title: `Pago de ${participant.label} registrado`,
        description: `${formatCurrency(amount)} pagados por ${(PAYMENT_METHODS.find(({ value }) => value === participant.method)?.label ?? "el método seleccionado").toLowerCase()}.`,
      });
      await refreshAfterPayerAction();

      if (customer) {
        try {
          await issuePosTablePaymentInvoice(tableId, paymentIds, customer);
          updateParticipant(participantId, (current) => ({
            ...current,
            billingRequestStatus: "REQUESTED",
          }));
          toast({
            title: `Factura individual de ${participant.label} solicitada`,
            description:
              "El pago ya estaba registrado; no se realizó otro cobro.",
          });
        } catch (error) {
          toast({
            title: "Pago registrado; factura pendiente",
            description:
              error instanceof Error
                ? error.message
                : "Completa el comprobante antes de liberar la mesa.",
            variant: "destructive",
          });
        }
        await refreshAfterPayerAction();
      }
    } catch (error) {
      toast({
        title: `No se pudo cobrar a ${participant.label}`,
        description:
          error instanceof Error ? error.message : "Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayerInvoiceConfirmation = (
    customer: BillingCustomerInput | null,
  ) => {
    setIsPayerInvoiceDialogOpen(false);
    const participantId = pendingInvoiceParticipantId;
    setPendingInvoiceParticipantId(null);
    if (!participantId) return;

    if (payerInvoiceFlow === "PAY") {
      void payParticipant(participantId, customer);
    } else {
      void decideExistingPaymentInvoice(participantId, customer);
    }
  };

  const cancelPayerInvoiceDialog = (nextOpen: boolean) => {
    setIsPayerInvoiceDialogOpen(nextOpen);
    if (!nextOpen) setPendingInvoiceParticipantId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cobrar cuenta de la mesa</DialogTitle>
          <DialogDescription>
            Cobra todas las órdenes juntas o asigna productos y cobra la parte
            de cada comensal por separado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {orders.length} órdenes en la cuenta
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <p className="font-semibold">{formatCurrency(pendingTotal)}</p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              value="full"
              disabled={
                hasSplitPayments ||
                (splitStep === "collect" && unpaidParticipants.length > 0)
              }
            >
              Cuenta completa
            </TabsTrigger>
            <TabsTrigger value="split">Dividir por comensal</TabsTrigger>
          </TabsList>

          <TabsContent value="full" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Un solo cobro para toda la mesa
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {hasSplitPayments
                    ? "Esta cuenta ya tiene pagos divididos. Asigna el saldo restante a un comensal para conservar su factura individual."
                    : "Registra el saldo pendiente de todas las órdenes en el método de pago seleccionado."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <Select
                    value={fullPaymentMethod}
                    onValueChange={(value: PaymentMethod) =>
                      setFullPaymentMethod(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => void submitFullAccount()}
                  disabled={
                    isSubmitting || pendingTotal <= 0 || hasSplitPayments
                  }
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Cobrar {formatCurrency(pendingTotal)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="split" className="space-y-4">
            {splitStep === "collect" ? (
              <>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="font-medium">Cobra cada cuenta por separado</p>
                  <p className="text-sm text-muted-foreground">
                    Cada cobro registra únicamente los productos asignados a ese
                    comensal. No se cobrará el resto de la mesa.
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Pagado: {formatCurrency(paidTotal)} · Por cobrar:{" "}
                    {formatCurrency(assignedTotal)}
                  </p>
                  {participantsWithPendingBilling.length > 0 && (
                    <p className="mt-1 text-sm text-amber-800">
                      Elige el comprobante individual de cada comensal antes de
                      terminar.
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {participants
                    .filter(
                      (participant) =>
                        Object.keys(participant.allocations).length > 0,
                    )
                    .map((participant) => {
                      const total =
                        participant.paidAmount ??
                        getParticipantTotal(participant);
                      const method = PAYMENT_METHODS.find(
                        ({ value }) => value === participant.method,
                      )?.label;
                      const assignedItems = orders.flatMap((order) =>
                        order.items
                          .filter(
                            (item) =>
                              (participant.allocations[item.id] ?? 0) > 0,
                          )
                          .map((item) => ({
                            id: item.id,
                            name: item.product.name,
                            quantity: participant.allocations[item.id],
                          })),
                      );
                      return (
                        <Card key={participant.id}>
                          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                  {participant.label || "Comensal sin nombre"}
                                </p>
                                {participant.status === "PAID" ? (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                    Pagado
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                    Pendiente
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {assignedItems
                                  .map(
                                    ({ name, quantity }) =>
                                      `${quantity} × ${name}`,
                                  )
                                  .join(" · ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {method}
                              </p>
                              {participant.status === "PAID" &&
                                participant.billingRequestStatus &&
                                participant.billingRequestStatus !==
                                  "NOT_REQUESTED" && (
                                  <p className="text-xs text-muted-foreground">
                                    {participant.billingRequestStatus ===
                                    "REQUESTED"
                                      ? "Factura electrónica solicitada"
                                      : "Recibo normal"}
                                  </p>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="text-lg font-semibold">
                                {formatCurrency(total)}
                              </span>
                              {participant.status === "READY" && (
                                <Button
                                  onClick={() =>
                                    openPayerInvoiceDialog(
                                      participant.id,
                                      "PAY",
                                    )
                                  }
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserRound className="mr-2 h-4 w-4" />
                                  )}
                                  Cobrar a {participant.label}
                                </Button>
                              )}
                              {participant.status === "PAID" &&
                                participantsWithPendingBilling.some(
                                  ({ id }) => id === participant.id,
                                ) && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      openPayerInvoiceDialog(
                                        participant.id,
                                        "DECIDE",
                                      )
                                    }
                                    disabled={isSubmitting}
                                  >
                                    Elegir comprobante
                                  </Button>
                                )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
                <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSplitStep("assign")}
                    disabled={isSubmitting}
                  >
                    Volver a asignar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void finishSplitCollection()}
                    disabled={
                      isSubmitting ||
                      unpaidParticipants.length > 0 ||
                      participantsWithPendingBilling.length > 0
                    }
                  >
                    Terminar división
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-52 flex-1 space-y-2">
                    <Label>¿A qué comensal le asignas productos?</Label>
                    <Select
                      value={selectedParticipantId}
                      onValueChange={setSelectedParticipantId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem
                            key={participant.id}
                            value={participant.id}
                            disabled={participant.status === "PAID"}
                          >
                            {participant.status === "PAID"
                              ? `✓ ${participant.label}`
                              : participant.label || "Comensal sin nombre"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addParticipant}
                    disabled={isSubmitting || participants.length >= 12}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir comensal
                  </Button>
                </div>

                <div className="space-y-2">
                  {participants.map((participant) => {
                    const total = getParticipantTotal(participant);
                    return (
                      <div
                        key={participant.id}
                        className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end ${
                          selectedParticipantId === participant.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <div className="space-y-1">
                          <Label htmlFor={`diner-${participant.id}`}>
                            Nombre o número
                          </Label>
                          <Input
                            id={`diner-${participant.id}`}
                            value={participant.label}
                            onChange={(event) =>
                              updateParticipant(participant.id, (current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                            maxLength={50}
                            disabled={
                              isSubmitting || participant.status === "PAID"
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Método de pago</Label>
                          <Select
                            value={participant.method}
                            disabled={
                              isSubmitting || participant.status === "PAID"
                            }
                            onValueChange={(method: PaymentMethod) =>
                              updateParticipant(participant.id, (current) => ({
                                ...current,
                                method,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-right text-sm font-medium">
                          {formatCurrency(total)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="max-h-[38vh] space-y-3 overflow-y-auto rounded-lg border p-3">
                  {orders.map((order) => {
                    const legacyPayment = hasUnallocatedPriorPayment(order);
                    const visibleItems = order.items.filter(
                      (item) =>
                        item.quantity -
                          getPriorAllocatedQuantity(order, item.id) >
                        0,
                    );
                    if (
                      order.isPaid ||
                      getRemainingAmount(order) <= 0 ||
                      visibleItems.length === 0
                    )
                      return null;
                    return (
                      <section key={order.id} className="space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-sm font-semibold">
                            Orden #{order.id.slice(0, 8)}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            Saldo {formatCurrency(getRemainingAmount(order))}
                          </span>
                        </div>
                        {legacyPayment && (
                          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                            Esta orden tiene un pago previo sin detalle por
                            producto. Usa “Cuenta completa” para cobrar el saldo
                            restante.
                          </p>
                        )}
                        {visibleItems.map((item) => {
                          const participant = participants.find(
                            ({ id }) => id === selectedParticipantId,
                          );
                          const assigned = participants.reduce(
                            (sum, current) =>
                              sum +
                              (current.status === "READY"
                                ? (current.allocations[item.id] ?? 0)
                                : 0),
                            0,
                          );
                          const previouslyAllocated = getPriorAllocatedQuantity(
                            order,
                            item.id,
                          );
                          const available = Math.max(
                            0,
                            item.quantity - previouslyAllocated - assigned,
                          );
                          const currentQuantity =
                            participant?.allocations[item.id] ?? 0;
                          const unitPrice = item.price ?? item.product.price;
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md bg-muted/30 p-2 sm:grid-cols-[1fr_auto_auto]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {item.product.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(unitPrice)} c/u ·{" "}
                                  {item.quantity} en la orden
                                  {previouslyAllocated > 0
                                    ? ` · ${previouslyAllocated} ya pagadas`
                                    : ""}
                                </p>
                                {item.variants && item.variants.length > 0 && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {item.variants
                                      .map(({ groupName, productVariant }) =>
                                        groupName
                                          ? `${groupName}: ${productVariant.name}`
                                          : productVariant.name,
                                      )
                                      .join(" · ")}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    changeAllocation(order, item.id, -1)
                                  }
                                  disabled={
                                    isSubmitting ||
                                    legacyPayment ||
                                    participant?.status === "PAID" ||
                                    currentQuantity === 0
                                  }
                                  aria-label={`Quitar una unidad de ${item.product.name}`}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="min-w-6 text-center text-sm font-semibold">
                                  {currentQuantity}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    changeAllocation(order, item.id, 1)
                                  }
                                  disabled={
                                    isSubmitting ||
                                    legacyPayment ||
                                    participant?.status === "PAID" ||
                                    available === 0
                                  }
                                  aria-label={`Asignar una unidad de ${item.product.name}`}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="col-span-2 text-right text-xs text-muted-foreground sm:col-span-1">
                                {formatCurrency(unitPrice * currentQuantity)} ·{" "}
                                {available} sin asignar
                              </p>
                            </div>
                          );
                        })}
                      </section>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Asignado: {formatCurrency(assignedTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Primero revisarás las cuentas. Cada comensal pagará solo
                      su parte.
                    </p>
                  </div>
                  <Button
                    onClick={continueToCollection}
                    disabled={isSubmitting || assignedTotal <= 0}
                  >
                    <UserRound className="mr-2 h-4 w-4" />
                    Revisar cuentas y cobrar
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
      <InvoiceCustomerDialog
        open={isPayerInvoiceDialogOpen}
        onOpenChange={cancelPayerInvoiceDialog}
        onConfirm={handlePayerInvoiceConfirmation}
        title={
          payerInvoiceFlow === "PAY"
            ? `Comprobante de ${participants.find(({ id }) => id === pendingInvoiceParticipantId)?.label ?? "comensal"}`
            : `Comprobante pendiente de ${participants.find(({ id }) => id === pendingInvoiceParticipantId)?.label ?? "comensal"}`
        }
        description={
          payerInvoiceFlow === "PAY"
            ? "Elige recibo normal o factura electrónica para este comensal. El pago de su parte se registrará una sola vez."
            : "El pago ya está registrado. Elige el comprobante de este comensal; no se realizará otro cobro."
        }
        confirmLabel={
          payerInvoiceFlow === "PAY"
            ? "Continuar al cobro"
            : "Registrar comprobante"
        }
      />
    </Dialog>
  );
}
