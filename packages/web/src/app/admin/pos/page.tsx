"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  CheckCircle2,
  ShoppingCart,
  Clock3,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import {
  getProducts,
  Product,
  ProductVariant,
  Category,
  getTables,
  Table,
  createPosOrder,
  getActiveOrders,
  processPayment,
  getCategories,
  getLocations,
  Location,
  issuePosInvoice,
  issuePosTableInvoice,
  declinePosTableInvoice,
  closePosTableAccount,
  getPosShiftStatus,
  openPosShift,
  getPosShiftSummary,
  closePosShift,
} from "@/lib/api";
import type {
  ActiveOrder,
  BillingCustomerInput,
  BillingDocumentResult,
  PaymentMethod,
  PosShiftStatus,
  PosShiftSummary,
} from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cart } from "@/components/admin/pos/cart";
import { ProductGrid } from "@/components/admin/pos/product-grid";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const ALL_LOCATIONS = "all";
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

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_LOCATIONS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<
    Record<
      string,
      {
        product: Product;
        variant?: ProductVariant;
        variants?: Array<ProductVariant & { groupName?: string }>;
        quantity: number;
      }
    >
  >({});
  const [orderType, setOrderType] = useState<"table" | "takeout" | "delivery">(
    "takeout",
  );
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shiftStatus, setShiftStatus] = useState<PosShiftStatus | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<PosShiftSummary | null>(
    null,
  );
  const [declaredAmounts, setDeclaredAmounts] = useState<
    Partial<Record<PaymentMethod, string>>
  >({});
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const posLocationId = isSuperAdmin
    ? selectedLocationId === ALL_LOCATIONS
      ? ""
      : selectedLocationId
    : (user?.locationId ?? "");

  const refreshShiftStatus = useCallback(async () => {
    if (!posLocationId) {
      setShiftStatus(null);
      setShiftError(null);
      setShiftLoading(false);
      return;
    }

    setShiftStatus(null);
    setShiftError(null);
    setShiftLoading(true);
    try {
      const status = await getPosShiftStatus(posLocationId);
      setShiftStatus(status);
      if (!status.shift) {
        setOpeningCash(String(status.defaultOpeningCash));
      }
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : "Intenta de nuevo.");
      toast({
        title: "No se pudo consultar el turno",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setShiftLoading(false);
    }
  }, [posLocationId, toast]);

  useEffect(() => {
    if (!isAuthLoading && user) void refreshShiftStatus();
  }, [isAuthLoading, refreshShiftStatus, user]);

  const handleOpenShift = async () => {
    const amount = Number(openingCash);
    if (!posLocationId || !Number.isFinite(amount) || amount < 0) {
      toast({
        title: "Revisa la base inicial",
        description:
          "Ingresa un valor de efectivo válido, igual o mayor que cero.",
        variant: "destructive",
      });
      return;
    }

    setShiftSubmitting(true);
    try {
      const shift = await openPosShift(posLocationId, amount);
      setShiftStatus((current) => (current ? { ...current, shift } : current));
      toast({
        title: "Turno abierto",
        description: `La caja inicia con ${formatCurrency(amount)} en efectivo.`,
      });
    } catch (err) {
      toast({
        title: "No se pudo abrir el turno",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
      await refreshShiftStatus();
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleOpenCloseWizard = async () => {
    const shift = shiftStatus?.shift;
    if (!shift) return;

    setShiftSubmitting(true);
    try {
      const summary = await getPosShiftSummary(shift.id);
      setShiftSummary(summary);
      setDeclaredAmounts({});
      setDiscrepancyNote("");
      setCloseShiftOpen(true);
    } catch (err) {
      toast({
        title: "No se pudo preparar el cierre",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!shiftStatus?.shift || !shiftSummary) return;
    const amounts = {} as Record<PaymentMethod, number>;
    for (const { value, label } of PAYMENT_METHODS) {
      const input = declaredAmounts[value];
      const amount =
        input === undefined || input.trim() === "" ? NaN : Number(input);
      if (!Number.isFinite(amount) || amount < 0) {
        toast({
          title: "Faltan valores por declarar",
          description: `Ingresa un valor válido para ${label.toLowerCase()}.`,
          variant: "destructive",
        });
        return;
      }
      amounts[value] = amount;
    }

    const hasDiscrepancy = PAYMENT_METHODS.some(
      ({ value }) =>
        Math.abs(amounts[value] - shiftSummary.expectedAmounts[value]) >= 0.01,
    );
    if (hasDiscrepancy && !discrepancyNote.trim()) {
      toast({
        title: "Explica la diferencia",
        description:
          "Agrega una nota antes de confirmar el cierre con diferencias.",
        variant: "destructive",
      });
      return;
    }

    setShiftSubmitting(true);
    try {
      await closePosShift(
        shiftStatus.shift.id,
        amounts,
        discrepancyNote.trim() || undefined,
      );
      setCloseShiftOpen(false);
      setShiftSummary(null);
      await refreshShiftStatus();
      toast({
        title: "Turno cerrado",
        description: "El arqueo y sus diferencias quedaron registrados.",
      });
    } catch (err) {
      toast({
        title: "No se pudo cerrar el turno",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setShiftSubmitting(false);
    }
  };

  // Fetch active orders when table is selected
  useEffect(() => {
    if (selectedTable) {
      void refreshActiveOrders().catch((err) => {
        console.error("Error fetching active orders:", err);
        toast({
          title: "Error",
          description: "No se pudieron cargar las órdenes activas",
          variant: "destructive",
        });
      });
    } else {
      setActiveOrders([]);
    }
  }, [selectedTable, toast]);

  const refreshActiveOrders = async () => {
    const orders = await getActiveOrders(selectedTable);
    const currentOrders = orders.filter(
      (order) => order.status !== "CANCELLED",
    );
    setActiveOrders(currentOrders);
    return currentOrders;
  };

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      if (!isSuperAdmin && !user.locationId) {
        throw new Error("Tu usuario no tiene una sucursal asignada.");
      }

      const [productsData, tablesData, categoriesData, locationsData] =
        await Promise.all([
          getProducts(
            isSuperAdmin ? undefined : (user.locationId ?? undefined),
          ),
          getTables(),
          getCategories(),
          getLocations(),
        ]);
      setProducts(
        productsData
          .filter((product) => !product.isIntermediate)
          .sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
          ),
      );
      setTables(tablesData);
      setCategories(categoriesData);
      setLocations(locationsData);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Error al cargar los datos. Por favor, intente de nuevo.");
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, toast, user]);

  useEffect(() => {
    if (!isAuthLoading && user) {
      void fetchData();
    }
  }, [fetchData, isAuthLoading, user]);

  // Nueva función para generar la clave del carrito
  function getCartKey(
    product: Product,
    variants?: ProductVariant[] | ProductVariant,
  ) {
    if (Array.isArray(variants) && variants.length > 0) {
      // Clave única por producto y variantes seleccionadas
      return `${product.id}__${variants.map((v) => v.id).join("_")}`;
    } else if (variants && !Array.isArray(variants)) {
      return `${product.id}__${variants.id}`;
    }
    return product.id;
  }

  // Actualizar handleAddToCart para soportar múltiples variantes
  const handleAddToCart = (
    product: Product,
    variantsOrVariant?: ProductVariant[] | ProductVariant,
  ) => {
    if (
      isSuperAdmin &&
      (selectedLocationId === ALL_LOCATIONS ||
        product.locationId !== selectedLocationId)
    ) {
      toast({
        title: "Selecciona una sede",
        description: "Elige la sede de esta venta antes de agregar productos.",
        variant: "destructive",
      });
      return;
    }

    const cartLocationIds = new Set(
      Object.values(cart)
        .map((item) => item.product.locationId)
        .filter(Boolean),
    );
    if (
      product.locationId &&
      [...cartLocationIds].some(
        (locationId) => locationId !== product.locationId,
      )
    ) {
      toast({
        title: "Productos de distintas sucursales",
        description:
          "El carrito solo puede incluir productos de una sucursal. Filtra por sucursal para continuar.",
        variant: "destructive",
      });
      return;
    }

    // Validar ids
    if (Array.isArray(variantsOrVariant)) {
      if (variantsOrVariant.some((v) => !v.id)) {
        toast({
          title: "Error",
          description: "Alguna variante seleccionada no tiene un ID válido.",
          variant: "destructive",
        });
        return;
      }
    } else if (variantsOrVariant && !variantsOrVariant.id) {
      toast({
        title: "Error",
        description: "La variante seleccionada no tiene un ID válido.",
        variant: "destructive",
      });
      return;
    }
    const key = getCartKey(product, variantsOrVariant);
    setCart((prev) => {
      const prevItem = prev[key];
      return {
        ...prev,
        [key]: {
          product,
          ...(Array.isArray(variantsOrVariant)
            ? { variants: variantsOrVariant }
            : variantsOrVariant
              ? { variant: variantsOrVariant }
              : {}),
          quantity: prevItem ? prevItem.quantity + 1 : 1,
        },
      };
    });
  };

  // Actualizar handleRemoveFromCart
  const handleRemoveFromCart = (key: string) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[key].quantity > 1) {
        newCart[key].quantity -= 1;
      } else {
        delete newCart[key];
      }
      return newCart;
    });
  };

  const handleCreateOrder = async (
    assignedLocationId?: string,
    invoiceCustomer?: BillingCustomerInput | null,
    checkoutPaymentMethod?: PaymentMethod,
  ) => {
    try {
      const orderLocationId = isSuperAdmin
        ? selectedLocationId
        : user?.locationId;
      if (!orderLocationId || orderLocationId === ALL_LOCATIONS) {
        toast({
          title: "Selecciona una sede",
          description: "Debes seleccionar una sede antes de crear el pedido.",
          variant: "destructive",
        });
        return;
      }

      if (assignedLocationId && assignedLocationId !== orderLocationId) {
        toast({
          title: "La sede no coincide",
          description:
            "La dirección de entrega está asignada a otra sede. Selecciona esa sede para continuar.",
          variant: "destructive",
        });
        return;
      }

      if (orderType === "table" && !selectedTable) {
        toast({
          title: "Error",
          description: "Por favor selecciona una mesa",
          variant: "destructive",
        });
        return;
      }

      if (
        (orderType === "takeout" || orderType === "delivery") &&
        !customerName.trim()
      ) {
        toast({
          title: "Error",
          description: "Por favor ingresa el nombre del cliente",
          variant: "destructive",
        });
        return;
      }

      if (orderType === "delivery") {
        if (!deliveryAddress.trim()) {
          toast({
            title: "Error",
            description: "Por favor ingresa la dirección de entrega",
            variant: "destructive",
          });
          return;
        }
        if (!phone.trim()) {
          toast({
            title: "Error",
            description: "Por favor ingresa el teléfono",
            variant: "destructive",
          });
          return;
        }
      }

      setSubmitting(true);
      const availableTables = isSuperAdmin
        ? tables.filter((table) => table.locationId === orderLocationId)
        : tables.filter((table) => table.locationId === user?.locationId);
      const selectedTableData = availableTables.find(
        (table) => table.id === selectedTable,
      );
      if (!selectedTableData && orderType === "table") {
        toast({
          title: "Error",
          description: "No se encontró la información de la mesa",
          variant: "destructive",
        });
        return;
      }

      const cartLocationIds = new Set(
        Object.values(cart)
          .map((item) => item.product.locationId)
          .filter(Boolean),
      );
      if (cartLocationIds.size > 1) {
        toast({
          title: "Productos de distintas sucursales",
          description:
            "El pedido debe contener productos de una sola sucursal.",
          variant: "destructive",
        });
        return;
      }

      const [productLocationId] = [...cartLocationIds];

      if (productLocationId && orderLocationId !== productLocationId) {
        toast({
          title: "La sucursal no coincide",
          description:
            "Selecciona la sucursal de los productos del carrito antes de crear el pedido.",
          variant: "destructive",
        });
        return;
      }

      const orderItems = Object.values(cart).map((item) => {
        let variantsArr: { productVariantId: string; groupName?: string }[] =
          [];
        // Soporte para múltiples variantes por item
        if (Array.isArray(item.variants) && item.variants.length > 0) {
          variantsArr = item.variants.map((v) => ({
            productVariantId: v.id,
            groupName: v.groupName || undefined,
          }));
        } else if (item.variant) {
          variantsArr = [{ productVariantId: item.variant.id }];
        }
        return {
          productId: item.product.id,
          quantity: item.quantity,
          variants: variantsArr,
        };
      });

      const locationId = orderLocationId;
      if (!locationId) {
        toast({
          title: "Error",
          description:
            "No se pudo determinar la ubicación. Por favor, asegúrate de tener una ubicación asignada o al menos una mesa creada.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const orderData = {
        tableId: orderType === "table" ? selectedTable : undefined,
        type:
          orderType === "table"
            ? ("TABLE" as const)
            : orderType === "delivery"
              ? ("DELIVERY" as const)
              : ("TAKEOUT" as const),
        locationId,
        customerName:
          orderType === "takeout" || orderType === "delivery"
            ? customerName
            : undefined,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        neighborhood: orderType === "delivery" ? neighborhood : undefined,
        phone: orderType === "delivery" ? phone : undefined,
        paymentMethod:
          orderType === "delivery"
            ? (checkoutPaymentMethod ?? paymentMethod)
            : undefined,
        items: orderItems,
        status:
          orderType === "takeout"
            ? ("IN_PROGRESS" as const)
            : ("PENDING" as const),
        isPaid: false,
        source: "POS" as const,
      };

      const createdOrder = await createPosOrder(orderData);

      // Si es para llevar, crear el pago automáticamente
      if (orderType === "takeout") {
        await processPayment(
          createdOrder.id,
          createdOrder.total,
          checkoutPaymentMethod ?? "CASH",
        );
      }

      let billingResult: BillingDocumentResult | null = null;
      let billingError: string | null = null;
      if (invoiceCustomer) {
        try {
          billingResult = await issuePosInvoice(
            [createdOrder.id],
            invoiceCustomer,
          );
        } catch (error) {
          billingError =
            error instanceof Error
              ? error.message
              : "No se pudo emitir la factura.";
        }
      }

      // Clear cart and form fields
      setCart({});
      setCustomerName("");
      setDeliveryAddress("");
      setNeighborhood("");
      setPhone("");
      setPaymentMethod("CASH");

      // Refresh active orders
      if (selectedTable) {
        await refreshActiveOrders();
      }

      toast({
        title: billingError
          ? "Pedido creado; factura pendiente"
          : billingResult
            ? "Pedido y factura procesados"
            : "Éxito",
        description: (
          <span
            className={`flex items-center justify-between ${billingError ? "text-destructive" : "text-green-600"}`}
          >
            <span>
              {billingError
                ? `El pedido quedó creado${orderType === "takeout" ? " y cobrado" : ""}, pero Factus no emitió la factura: ${billingError}`
                : billingResult
                  ? `Pedido creado. Estado de factura: ${billingResult.status}.`
                  : "Pedido creado correctamente"}
            </span>
            <CheckCircle2
              className="ml-4"
              style={{ width: "60px", height: "60px" }}
            />
          </span>
        ),
        variant: billingError ? "destructive" : "default",
      });
    } catch (err) {
      console.error("Error creating order:", err);
      toast({
        title: "Error",
        description: "Error al crear el pedido",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTableOrdersChanged = async () => {
    if (!selectedTable) return [];
    return refreshActiveOrders();
  };

  const closeSelectedTableAccount = async (allowIncompleteOrders = false) => {
    if (!selectedTable) {
      throw new Error("Selecciona una mesa antes de cerrar la cuenta.");
    }
    const result = await closePosTableAccount(
      selectedTable,
      allowIncompleteOrders,
    );
    await refreshActiveOrders();
    return result;
  };

  const handleCloseTableAccount = async (allowIncompleteOrders = false) => {
    const result = await closeSelectedTableAccount(allowIncompleteOrders);
    toast({
      title: "Mesa liberada",
      description: `Cuenta cerrada. ${result.closedOrderCount} órdenes quedan en el historial.`,
    });
  };

  const handleTableInvoiceDecision = async (
    customer: BillingCustomerInput | null,
    orderIds: string[],
    closeAccountAfterDecision = false,
    allowIncompleteOrders = false,
  ) => {
    if (!selectedTable) {
      throw new Error("Selecciona una mesa antes de facturar.");
    }

    try {
      if (!customer) {
        await declinePosTableInvoice(selectedTable, orderIds);
        if (closeAccountAfterDecision) {
          const result = await closeSelectedTableAccount(allowIncompleteOrders);
          toast({
            title: "Mesa liberada",
            description: `Recibo normal registrado. ${result.closedOrderCount} órdenes quedan en el historial.`,
          });
        } else {
          await refreshActiveOrders();
          toast({
            title: "Recibo normal registrado",
            description: "La cuenta de la mesa continúa abierta.",
          });
        }
        return;
      }

      const document = await issuePosTableInvoice(
        selectedTable,
        orderIds,
        customer,
      );
      if (closeAccountAfterDecision) {
        const result = await closeSelectedTableAccount(allowIncompleteOrders);
        toast({
          title: "Mesa liberada",
          description: `Factura procesada (${document.status}). ${result.closedOrderCount} órdenes quedan en el historial.`,
        });
      } else {
        await refreshActiveOrders();
        toast({
          title: "Factura de mesa procesada",
          description: `Estado de Factus: ${document.status}.`,
        });
      }
    } catch (error) {
      await refreshActiveOrders();
      throw error;
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesLocation =
      !isSuperAdmin ||
      (selectedLocationId !== ALL_LOCATIONS &&
        product.locationId === selectedLocationId);
    const matchesCategory =
      selectedCategory === "all" || product.categoryId === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLocation && matchesCategory && matchesSearch;
  });

  const groupedProducts =
    selectedCategory === "all"
      ? categories
          .map((category) => ({
            categoryName: category.name,
            categoryId: category.id,
            products: filteredProducts.filter(
              (p) => p.categoryId === category.id,
            ),
          }))
          .filter((group) => group.products.length > 0)
      : filteredProducts.length > 0
        ? [
            {
              categoryName:
                categories.find((c) => c.id === selectedCategory)?.name || "",
              categoryId: selectedCategory,
              products: filteredProducts,
            },
          ]
        : [];

  // Get all active orders for selected table
  const currentOrders = activeOrders;
  const cartItemCount = Object.values(cart).reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const showMobileCart = cartItemCount > 0 || currentOrders.length > 0;

  const renderCart = (className?: string) => (
    <Cart
      className={className}
      items={Object.values(cart)}
      onUpdateQuantity={(key, quantity) => {
        setCart((prev) => {
          if (quantity <= 0) {
            const newCart = { ...prev };
            delete newCart[key];
            return newCart;
          } else {
            return {
              ...prev,
              [key]: {
                ...prev[key],
                quantity,
              },
            };
          }
        });
      }}
      onRemoveItem={handleRemoveFromCart}
      orderType={orderType}
      selectedTable={selectedTable}
      tables={
        isSuperAdmin
          ? selectedLocationId === ALL_LOCATIONS
            ? []
            : tables.filter((table) => table.locationId === selectedLocationId)
          : tables.filter((table) => table.locationId === user?.locationId)
      }
      onOrderTypeChange={setOrderType}
      onTableSelect={(tableId) => {
        setSelectedTable(tableId);
        setCart({});
      }}
      onSubmit={handleCreateOrder}
      currentOrders={currentOrders}
      onTableOrdersChanged={handleTableOrdersChanged}
      onTableInvoiceDecision={handleTableInvoiceDecision}
      onCloseTableAccount={handleCloseTableAccount}
      loading={submitting}
      customerName={customerName}
      onCustomerNameChange={setCustomerName}
      deliveryAddress={deliveryAddress}
      onDeliveryAddressChange={setDeliveryAddress}
      neighborhood={neighborhood}
      onNeighborhoodChange={setNeighborhood}
      phone={phone}
      onPhoneChange={setPhone}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
    />
  );

  if (loading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-muted-foreground">Cargando POS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => void fetchData()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  if (shiftLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">
            Consultando el turno de caja...
          </p>
        </div>
      </div>
    );
  }

  if (shiftError) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>No se pudo verificar el turno</CardTitle>
            <p className="text-sm text-muted-foreground">{shiftError}</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void refreshShiftStatus()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!posLocationId) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Selecciona una sede</CardTitle>
            <p className="text-sm text-muted-foreground">
              Para iniciar o continuar una caja, primero elige la sede donde vas
              a operar.
            </p>
          </CardHeader>
          <CardContent>
            <Select
              value={
                selectedLocationId === ALL_LOCATIONS
                  ? undefined
                  : selectedLocationId
              }
              onValueChange={(locationId) => {
                setSelectedLocationId(locationId);
                setCart({});
                setSelectedTable("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una sede" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!shiftStatus?.shift) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <CardTitle>Abre tu turno de caja</CardTitle>
            <p className="text-sm text-muted-foreground">
              Antes de vender, cuenta el efectivo disponible y registra la base
              inicial. Las ventas y los pagos quedarán asociados a este turno.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="opening-cash">
                Base inicial en efectivo (COP)
              </Label>
              <Input
                id="opening-cash"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
                disabled={shiftSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Valor sugerido por la configuración de esta sede:{" "}
                {formatCurrency(shiftStatus?.defaultOpeningCash ?? 0)}.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => void handleOpenShift()}
              disabled={shiftSubmitting}
            >
              {shiftSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clock3 className="mr-2 h-4 w-4" />
              )}
              Iniciar turno
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasDeclaredDiscrepancy = Boolean(
    shiftSummary &&
      PAYMENT_METHODS.some(({ value }) => {
        const input = declaredAmounts[value];
        return (
          input !== undefined &&
          input.trim() !== "" &&
          Math.abs(Number(input) - shiftSummary.expectedAmounts[value]) >= 0.01
        );
      }),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 pb-20 lg:pb-4 min-h-[calc(100dvh-4rem)] lg:h-[calc(100vh-4rem)]">
      <div className="lg:col-span-3 lg:h-full">
        <Card className="lg:h-full lg:flex lg:flex-col">
          <CardHeader className="flex-none">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Punto de Venta</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Turno abierto desde{" "}
                    {new Date(shiftStatus.shift.startedAt).toLocaleString(
                      "es-CO",
                    )}
                    {" · "}Base: {formatCurrency(shiftStatus.shift.openingCash)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleOpenCloseWizard()}
                  disabled={shiftSubmitting}
                >
                  {shiftSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Clock3 className="mr-2 h-4 w-4" />
                  )}
                  Cerrar turno
                </Button>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                {isSuperAdmin && (
                  <Select
                    value={
                      selectedLocationId === ALL_LOCATIONS
                        ? undefined
                        : selectedLocationId
                    }
                    onValueChange={(locationId) => {
                      setSelectedLocationId(locationId);
                      setCart({});
                      setSelectedTable("");
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Selecciona una sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="lg:flex-1 lg:overflow-y-auto">
            {isSuperAdmin && selectedLocationId === ALL_LOCATIONS ? (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                Selecciona una sede para ver sus productos y crear pedidos.
              </div>
            ) : (
              <ProductGrid
                groupedProducts={groupedProducts}
                onAddToCart={handleAddToCart}
                cart={Object.fromEntries(
                  Object.entries(cart).map(([key, item]) => [
                    key,
                    item.quantity,
                  ]),
                )}
                showLocationName={isSuperAdmin}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:col-span-1 lg:block lg:h-full">
        <div className="sticky top-4">{renderCart()}</div>
      </div>
      {showMobileCart && (
        <Button
          type="button"
          className="fixed inset-x-4 bottom-4 z-40 h-12 justify-between shadow-lg lg:hidden"
          onClick={() => setIsMobileCartOpen(true)}
          disabled={submitting}
          aria-label={`Abrir carrito con ${cartItemCount} productos`}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {cartItemCount > 0
              ? `Ver carrito · ${cartItemCount}`
              : "Ver cuenta"}
          </span>
          <span>
            {currentOrders.length > 0
              ? `${currentOrders.length} órdenes`
              : "Continuar"}
          </span>
        </Button>
      )}
      <Dialog open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg overflow-y-auto p-2 max-h-[90dvh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Carrito y cuenta</DialogTitle>
            <DialogDescription>
              Revisa los productos, ajusta las cantidades y completa la venta.
            </DialogDescription>
          </DialogHeader>
          {renderCart("h-[82dvh] min-h-0 flex flex-col")}
        </DialogContent>
      </Dialog>
      <Dialog
        open={closeShiftOpen}
        onOpenChange={(open) => {
          if (!shiftSubmitting) setCloseShiftOpen(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asistente de cierre de turno</DialogTitle>
            <DialogDescription>
              Cuenta el dinero y confirma los valores reales por medio de pago.
              Compara tus valores con los registrados por el sistema.
            </DialogDescription>
          </DialogHeader>
          {shiftSummary && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Órdenes</p>
                  <p className="mt-1 font-semibold">
                    {shiftSummary.orderCount}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Pagos registrados
                  </p>
                  <p className="mt-1 font-semibold">
                    {shiftSummary.paymentCount}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Ventas recaudadas
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatCurrency(shiftSummary.collectedTotal)}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {PAYMENT_METHODS.map(({ value, label }) => {
                  const expected = shiftSummary.expectedAmounts[value];
                  const rawDeclared = declaredAmounts[value] ?? "";
                  const declared =
                    rawDeclared.trim() === "" ? null : Number(rawDeclared);
                  const difference =
                    declared === null || !Number.isFinite(declared)
                      ? null
                      : declared - expected;
                  return (
                    <div
                      key={value}
                      className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1.2fr] sm:items-end"
                    >
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          Esperado: {formatCurrency(expected)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor={`declared-${value}`}
                          className="text-xs"
                        >
                          Contado / declarado
                        </Label>
                        <Input
                          id={`declared-${value}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          value={rawDeclared}
                          onChange={(event) =>
                            setDeclaredAmounts((current) => ({
                              ...current,
                              [value]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <p
                        className={`text-xs ${difference !== null && Math.abs(difference) >= 0.01 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {difference === null
                          ? "Ingresa el valor contado para comparar."
                          : `Diferencia: ${formatCurrency(difference)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
              {hasDeclaredDiscrepancy && (
                <div className="space-y-2">
                  <Label htmlFor="discrepancy-note">
                    Explicación de las diferencias
                  </Label>
                  <Input
                    id="discrepancy-note"
                    value={discrepancyNote}
                    onChange={(event) => setDiscrepancyNote(event.target.value)}
                    placeholder="Describe brevemente el motivo"
                  />
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCloseShiftOpen(false)}
                  disabled={shiftSubmitting}
                >
                  Seguir atendiendo
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleCloseShift()}
                  disabled={shiftSubmitting}
                >
                  {shiftSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Confirmar cierre
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
