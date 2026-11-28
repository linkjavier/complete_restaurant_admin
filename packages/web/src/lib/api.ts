import {
  getAuthToken as getStoredAuthToken,
  removeAuthToken as clearStoredAuthToken,
} from "@/lib/auth";

function getApiUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  }
  const backendBase = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  const host = window.location.hostname; // gluonico.localhost o gluonico.kutchenbrain.xyz
  const parts = host.split(".");
  const subdomain =
    host.endsWith(".localhost") && parts.length > 1 ? parts[0] : null;

  // LOCALHOST con subdominio (ej: gluonico.localhost:3001)
  if (host.endsWith(".localhost") && subdomain) {
    return `http://${subdomain}.localhost:3000`;
  }
  // LOCALHOST sin subdominio
  if (
    host === "localhost" ||
    host === "localhost:3000" ||
    host === "localhost:3001"
  ) {
    return "http://localhost:3000";
  }
  return backendBase;
}

export const API_URL = getApiUrl();

console.log(process.env.NEXT_PUBLIC_API_URL);
console.log(API_URL);

export interface ProductVariant {
  id: string;
  name: string;
  price?: number;
  image?: string;
  isActive?: boolean;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  order?: number;
  variants: ProductVariant[];
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  categoryId: string;
  category?: Category;
  isActive: boolean;
  isIntermediate: boolean;
  unit: string;
  locationId: string;
  location?: Location;
  ingredients?: ProductIngredient[];
  components?: ProductComponent[];
  createdAt?: string;
  updatedAt?: string;
  quantity: number;
  variantGroups?: ProductVariantGroup[];
}

export interface QrMenuProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  categoryId: string;
  category: { id?: string; name: string } | null;
  ar: ProductArExperience | null;
}

export interface ProductArExperience {
  model3dUrl: string;
  modelUsdzUrl: string | null;
  thumbnailUrl: string | null;
  scale: { x: number; y: number; z: number } | null;
  placement: "floor" | "wall";
}

export interface ProductArConfiguration {
  id: string;
  enabled: boolean;
  model3dUrl: string | null;
  modelUsdzUrl: string | null;
  thumbnailUrl: string | null;
  scale: { x: number; y: number; z: number } | null;
  placement: "floor" | "wall";
  modelFileSize: number | null;
}

interface ProductArAssetResponse {
  id: string;
  arEnabled: boolean;
  model3dUrl: string | null;
  modelUsdzUrl: string | null;
  modelThumbnailUrl: string | null;
  modelScale: { x: number; y: number; z: number } | null;
  arPlacement: "floor" | "wall";
  modelFileSize: number | null;
}

interface ApiErrorResponse {
  message?: string | string[];
  code?: string;
}

function isProductArAssetResponse(
  value: Partial<ProductArAssetResponse>,
): value is ProductArAssetResponse {
  const scale = value.modelScale;
  const validScale =
    scale === null ||
    (typeof scale === "object" &&
      scale !== undefined &&
      Number.isFinite(scale.x) &&
      Number.isFinite(scale.y) &&
      Number.isFinite(scale.z));
  return (
    typeof value.id === "string" &&
    typeof value.arEnabled === "boolean" &&
    (value.model3dUrl === null || typeof value.model3dUrl === "string") &&
    (value.modelUsdzUrl === null || typeof value.modelUsdzUrl === "string") &&
    (value.modelThumbnailUrl === null ||
      typeof value.modelThumbnailUrl === "string") &&
    validScale &&
    (value.arPlacement === "floor" || value.arPlacement === "wall") &&
    (value.modelFileSize === null ||
      (typeof value.modelFileSize === "number" &&
        Number.isFinite(value.modelFileSize)))
  );
}

export interface QrMenuBanner {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  order?: number;
}

export interface QrMenuConfiguration {
  location: { id: string; name: string; phone: string };
  enabled: boolean;
  orderingEnabled: boolean;
  primaryColor: string;
  whatsappPhone: string;
  products: QrMenuProduct[];
  productIds: string[];
  productsConfigured: boolean;
  banners: QrMenuBanner[];
}

export interface PublicQrMenu
  extends Omit<QrMenuConfiguration, "productIds" | "productsConfigured"> {
  name: string;
  logo: string | null;
  location: {
    id: string;
    name: string;
    address: string;
    city: string | null;
    country: string | null;
    phone: string;
  };
}

export type QrMenuConfigurationUpdate = Pick<
  QrMenuConfiguration,
  | "enabled"
  | "orderingEnabled"
  | "primaryColor"
  | "whatsappPhone"
  | "productIds"
  | "banners"
>;

export interface Table {
  id: string;
  number: number;
  seats: number;
  status: string;
  qrCode?: string;
  locationId: string;
  location?: Location;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingLocationConfiguration {
  locationId: string;
  countryCode: string;
  issuerLegalName: string | null;
  issuerTaxId: string | null;
  issuerTaxIdDv: string | null;
  establishmentName: string | null;
  establishmentAddress: string | null;
  establishmentMunicipalityCode: string | null;
  establishmentPhone: string | null;
  establishmentEmail: string | null;
  numberingRangeId: number | null;
  credentialsConfigured: boolean;
  isReady: boolean;
  missingFields: BillingLocationMissingField[];
}

export type BillingLocationMissingField =
  | "issuerLegalName"
  | "issuerTaxId"
  | "issuerTaxIdDv"
  | "establishmentName"
  | "establishmentAddress"
  | "establishmentMunicipalityCode"
  | "establishmentPhone"
  | "establishmentEmail"
  | "factusCredentials";

export interface BillingLocationConfigurationUpdate {
  issuerLegalName: string | null;
  issuerTaxId: string | null;
  issuerTaxIdDv: string | null;
  establishmentName: string | null;
  establishmentAddress: string | null;
  establishmentMunicipalityCode: string | null;
  establishmentPhone: string | null;
  establishmentEmail: string | null;
  numberingRangeId: number | null;
  factusClientId?: string;
  factusClientSecret?: string;
  factusUsername?: string;
  factusPassword?: string;
}

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  neighborhood?: string;
  whatsappId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenOrderItem {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED";
  quantity: number;
  notes?: string;
  product: { id: string; name: string; image?: string };
  productVariant?: {
    id?: string;
    name: string;
    image?: string;
    price?: number;
  };
}

export interface KitchenOrder {
  id: string;
  type: "TABLE" | "TAKEOUT" | "DELIVERY";
  customerName?: string;
  createdAt: string;
  table?: { number: number };
  items: KitchenOrderItem[];
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  products?: Product[];
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  minQuantity: number;
  locationId: string;
  location?: Location;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStockItem {
  id: string;
  code?: string | null;
  type: "PRODUCT" | "INGREDIENT";
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  minQuantity?: number;
  locationId: string;
  locationName: string;
  categoryName: string | null;
  productKind: "PRODUCT" | "INTERMEDIATE" | null;
  isActive: boolean;
  image: string | null;
  updatedAt: string;
  recipeIngredients: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  recipeComponents: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export interface InventoryModificationItem {
  id: string;
  itemType: InventoryStockItem["type"];
  itemId: string;
  itemName: string;
  itemCode: string | null;
  unit: string;
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  countedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryModification {
  id: string;
  number: number;
  status: "DRAFT" | "APPLIED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  appliedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  location: { id: string; name: string };
  items: InventoryModificationItem[];
}

export interface InventoryModificationSummary {
  id: string;
  number: number;
  status: InventoryModification["status"];
  notes: string | null;
  createdAt: string;
  appliedAt: string | null;
  createdBy: InventoryModification["createdBy"];
  appliedBy: InventoryModification["createdBy"] | null;
  location: InventoryModification["location"];
  _count: { items: number };
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  ingredient?: Ingredient;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  tenantId: string;
  locationId: string;
  supplierName: string;
  purchaseDate: string;
  totalCost?: number | null;
  createdById: string;
  createdBy?: User;
  location?: Location;
  items?: PurchaseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductIngredient {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
  product?: Product;
  ingredient?: Ingredient;
  createdAt: string;
  updatedAt: string;
}

export interface ProductComponent {
  id: string;
  productId: string;
  componentId: string;
  quantity: number;
  component?: Product;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod =
  | "CASH"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "QR"
  | "TRANSFER";

export interface BillingCustomerInput {
  identificationDocumentCode: string;
  identification: string;
  legalOrganizationCode: string;
  company?: string;
  names?: string;
  dv?: string;
  email?: string;
}

export interface BillingDocumentResult {
  id: string;
  status: string;
  documentNumber?: string | null;
  cufe?: string | null;
  errorMessage?: string | null;
}

export type BillingDocumentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "FAILED_RETRYABLE"
  | "RECONCILIATION_REQUIRED";

export interface BillingDocumentListItem {
  id: string;
  locationId: string;
  locationName: string;
  status: BillingDocumentStatus;
  providerName: string;
  documentNumber: string | null;
  cufe: string | null;
  referenceCode: string;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  orderIds: string[];
  customerName: string | null;
  customerIdentification: string | null;
  totalAmount: number | null;
}

export interface BillingDocumentDetail extends BillingDocumentListItem {
  type: string;
  countryCode: string;
  providerReferenceId: string | null;
  requestPayload: unknown;
  responseMetadata: unknown;
  orderLinks: Array<{
    id: string;
    createdAt: string;
    total: number | null;
    isPaid?: boolean;
    status?: string;
  }>;
  payments: Array<{
    id: string;
    orderId: string;
    amount: number;
    method: PaymentMethod;
    status?: string;
    createdAt?: string;
  }>;
}

export interface BillingDocumentsResponse {
  items: BillingDocumentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    byStatus: Record<BillingDocumentStatus, number>;
  };
}

export interface SalesReport {
  period: { from: string; to: string };
  locationId: string | null;
  summary: {
    salesTotal: number;
    paidOrderCount: number;
    averageTicket: number;
    previousSalesTotal: number;
    salesChangePercent: number | null;
    collectedTotal: number;
    outstandingTotal: number;
    unpaidOrderCount: number;
  };
  dailySales: Array<{ date: string; sales: number; orderCount: number }>;
  salesByLocation: Array<{
    locationId: string | null;
    locationName: string;
    sales: number;
    paidOrderCount: number;
  }>;
  paymentMethods: Array<{ method: string; amount: number }>;
  topProducts: Array<{ productId: string; name: string; quantity: number }>;
  recentOrders: Array<{
    id: string;
    createdAt: string;
    total: number | null;
    isPaid: boolean;
    status: string;
    type: string;
    customerName: string | null;
    billingRequestStatus: "NOT_REQUESTED" | "REQUESTED" | "DECLINED";
    billingDocuments: Array<{
      id: string;
      status: BillingDocumentStatus;
      documentNumber: string | null;
      cufe: string | null;
    }>;
  }>;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: "PENDING" | "COMPLETED" | "FAILED";
  payerLabel?: string | null;
  payerGroupId?: string | null;
  billingRequestStatus?: "NOT_REQUESTED" | "REQUESTED" | "DECLINED";
  billingDocumentId?: string | null;
  allocations?: TableSettlementAllocation[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TableSettlementAllocation {
  orderItemId: string;
  quantity: number;
}

export interface TableSettlementParticipant {
  label: string;
  method: PaymentMethod;
  allocations: TableSettlementAllocation[];
  invoiceChoice?: "ELECTRONIC" | "RECEIPT";
}

export type TableSettlementRequest =
  | { mode: "FULL"; method: PaymentMethod }
  | { mode: "SPLIT"; participants: TableSettlementParticipant[] };

export interface PaymentDetails {
  orderId: string;
  orderStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  payments: Payment[];
}

export interface ActiveOrder {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  isPaid: boolean;
  billingRequestStatus: "NOT_REQUESTED" | "REQUESTED" | "DECLINED";
  items: Array<{
    id: string;
    price: number | null;
    product: { name: string; price: number };
    quantity: number;
    status: string;
    variants?: Array<{
      groupName: string | null;
      productVariant: { name: string };
    }>;
  }>;
  payments: Payment[];
}

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locationId: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccessRequest {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  requestedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  locationId?: string;
  avatar?: string;
}

export interface UpdateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locationId?: string;
  avatar?: string;
}

export const getTenantIdFromSubdomain = () => {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname; // Ej: gluonico.kutchenbrain.xyz o gluonico.localhost
  const parts = host.split(".");
  if (host.endsWith(".localhost") && parts.length > 1) {
    return parts[0];
  }
  if (parts.length > 2 && parts[0] !== "www") {
    return parts[0];
  }
  return null;
};

export const getAuthHeaders = (isMultipart = false) => {
  const token = getStoredAuthToken();
  const tenantId = getTenantIdFromSubdomain();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
  };

  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  if (!tenantId) {
    console.warn(
      "[getAuthHeaders] WARNING: No tenantId detected from subdomain! Host:",
      window.location.hostname,
    );
  }
  return headers;
};

export function getAuthToken(): string | null {
  return getStoredAuthToken();
}

export async function getProducts(
  locationId?: string,
  categoryId?: string,
  search?: string,
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (locationId) params.append("locationId", locationId);
  if (categoryId) params.append("categoryId", categoryId);
  if (search) params.append("search", search);

  const response = await fetch(
    `${API_URL}/products${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: getAuthHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error("Error al obtener los productos");
  }
  return response.json();
}

export async function getQrMenuConfiguration(
  locationId: string,
): Promise<QrMenuConfiguration> {
  const response = await fetch(
    `${API_URL}/qr-menu/manage/${encodeURIComponent(locationId)}`,
    { headers: getAuthHeaders() },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message ||
        `No se pudo cargar la configuración del Menú QR (HTTP ${response.status})`,
    );
  }
  return response.json();
}

export async function saveQrMenuConfiguration(
  locationId: string,
  configuration: QrMenuConfigurationUpdate,
): Promise<QrMenuConfiguration> {
  const response = await fetch(
    `${API_URL}/qr-menu/manage/${encodeURIComponent(locationId)}`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(configuration),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || "No se pudo guardar la configuración del Menú QR",
    );
  }
  return response.json();
}

export async function getPublicQrMenu(
  locationId: string,
): Promise<PublicQrMenu> {
  const response = await fetch(
    `${API_URL}/qr-menu/public/${encodeURIComponent(locationId)}`,
  );
  if (!response.ok) {
    throw new Error("Este menú no está disponible");
  }
  return response.json();
}

export async function getTable(id: string): Promise<Table> {
  const response = await fetch(`${API_URL}/tables/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener la información de la mesa");
  }
  return response.json();
}

export async function getTables(): Promise<Table[]> {
  const response = await fetch(`${API_URL}/tables`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener las mesas");
  }
  return response.json();
}

export async function createTable(
  data: Omit<Table, "id" | "status" | "qrCode">,
): Promise<Table> {
  const response = await fetch(`${API_URL}/tables`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error al crear la mesa");
  }
  return response.json();
}

export async function updateTable(
  id: string,
  data: Partial<Omit<Table, "id" | "status" | "qrCode">>,
): Promise<Table> {
  const response = await fetch(`${API_URL}/tables/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error al actualizar la mesa");
  }
  return response.json();
}

export async function deleteTable(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/tables/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al eliminar la mesa");
  }
}

export async function getLocations(): Promise<Location[]> {
  const response = await fetch(`${API_URL}/locations`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener las ubicaciones");
  }
  return response.json();
}

export async function getBillingLocationConfiguration(
  locationId: string,
): Promise<BillingLocationConfiguration> {
  const response = await fetch(
    `${API_URL}/billing/configuration/${encodeURIComponent(locationId)}`,
    { headers: getAuthHeaders() },
  );
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;
    throw new Error(
      message ||
        `No se pudo cargar la configuración de facturación (HTTP ${response.status})`,
    );
  }
  return response.json();
}

export async function saveBillingLocationConfiguration(
  locationId: string,
  configuration: BillingLocationConfigurationUpdate,
): Promise<BillingLocationConfiguration> {
  const response = await fetch(
    `${API_URL}/billing/configuration/${encodeURIComponent(locationId)}`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(configuration),
    },
  );
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;
    throw new Error(
      message ||
        `No se pudo guardar la configuración de facturación (HTTP ${response.status})`,
    );
  }
  return response.json();
}

export async function testBillingLocationConnection(
  locationId: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/billing/configuration/${encodeURIComponent(locationId)}/test-connection`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;
    throw new Error(
      message
        ? `${message}${error.code ? ` (${error.code})` : ""}`
        : `No se pudo validar la conexión con Factus (HTTP ${response.status})${error.code ? ` (${error.code})` : ""}`,
    );
  }
}

export async function createLocation(data: {
  name: string;
  address: string;
  phone: string;
  city?: string;
  country?: string;
}): Promise<Location> {
  const response = await fetch(`${API_URL}/locations`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Error al crear la ubicación");
  }
  return response.json();
}

export async function createFirstLocation(data: {
  name: string;
  address: string;
  phone: string;
  city?: string;
  country?: string;
}): Promise<Location> {
  const response = await fetch(`${API_URL}/locations/first`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(", ")
        : message || "No se pudo crear la ubicación inicial",
    );
  }
  return response.json();
}

export async function updateLocation(
  id: string,
  data: Partial<Omit<Location, "id" | "createdAt" | "updatedAt">>,
): Promise<Location> {
  const response = await fetch(`${API_URL}/locations/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Error al actualizar la ubicación");
  }
  return response.json();
}

export async function deleteLocation(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/locations/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al eliminar la ubicación");
  }
}

export async function getProduct(id: string): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch product");
  }
  return response.json();
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/categories`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener las categorías");
  }
  return response.json();
}

export async function createCategory(data: {
  name: string;
  description?: string;
}): Promise<Category> {
  const response = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error al crear la categoría");
  }
  return response.json();
}

export async function updateCategory(
  id: string,
  data: { name: string; description?: string },
): Promise<Category> {
  const response = await fetch(`${API_URL}/categories/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error al actualizar la categoría");
  }
  return response.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/categories/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al eliminar la categoría");
  }
}

export async function getIngredients(): Promise<Ingredient[]> {
  const response = await fetch(`${API_URL}/ingredients`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener los ingredientes");
  }
  return response.json();
}

export async function getInventoryOverview(
  locationId?: string,
): Promise<InventoryStockItem[]> {
  const params = new URLSearchParams();
  if (locationId) params.set("locationId", locationId);
  const query = params.toString();
  const response = await fetch(
    `${API_URL}/inventory/overview${query ? `?${query}` : ""}`,
    { headers: getAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error("No se pudo cargar el inventario");
  }
  return response.json();
}

async function inventoryRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}/inventory/${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(
      message || "No se pudo guardar la modificación de inventario",
    );
  }
  return response.json();
}

export function getInventoryModifications(): Promise<
  InventoryModificationSummary[]
> {
  return inventoryRequest("modifications");
}

export function getInventoryModification(
  id: string,
): Promise<InventoryModification> {
  return inventoryRequest(`modifications/${id}`);
}

export function createInventoryModification(data: {
  locationId: string;
  notes?: string;
}): Promise<InventoryModification> {
  return inventoryRequest("modifications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function countInventoryModificationItem(
  modificationId: string,
  data: {
    itemId: string;
    itemType: InventoryStockItem["type"];
    countedQuantity: number;
  },
): Promise<InventoryModificationItem> {
  return inventoryRequest(`modifications/${modificationId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function removeInventoryModificationItem(
  modificationId: string,
  itemLineId: string,
): Promise<{ success: boolean }> {
  return inventoryRequest(
    `modifications/${modificationId}/items/${itemLineId}`,
    { method: "DELETE" },
  );
}

export function applyInventoryModification(
  id: string,
): Promise<InventoryModification> {
  return inventoryRequest(`modifications/${id}/apply`, {
    method: "POST",
  });
}

export async function createIngredient(data: {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  locationId: string;
}): Promise<Ingredient> {
  const response = await fetch(`${API_URL}/ingredients`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(message || "Error al crear el ingrediente");
  }
  return response.json();
}

export async function updateIngredient(
  id: string,
  data: {
    name?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    minQuantity?: number;
    locationId?: string;
  },
): Promise<Ingredient> {
  const response = await fetch(`${API_URL}/ingredients/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error al actualizar el ingrediente");
  }
  return response.json();
}

export async function deleteIngredient(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/ingredients/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al eliminar el ingrediente");
  }
}

export async function getPurchases(params?: {
  fromDate?: string;
  toDate?: string;
  ingredientId?: string;
  locationId?: string;
}): Promise<Purchase[]> {
  const searchParams = new URLSearchParams();
  if (params?.fromDate) searchParams.append("fromDate", params.fromDate);
  if (params?.toDate) searchParams.append("toDate", params.toDate);
  if (params?.ingredientId)
    searchParams.append("ingredientId", params.ingredientId);
  if (params?.locationId) searchParams.append("locationId", params.locationId);

  const url = `${API_URL}/purchases${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener las compras");
  }
  return response.json();
}

export async function createPurchase(data: {
  supplierName: string;
  purchaseDate: string;
  locationId: string;
  totalCost?: number;
  items: {
    ingredientId: string;
    quantity: number;
    unitCost: number;
  }[];
}): Promise<Purchase> {
  const response = await fetch(`${API_URL}/purchases`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Error al crear la compra");
  }
  return response.json();
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: string;
  locationId: string;
  isActive: boolean;
  isIntermediate?: boolean;
  unit?: string;
  quantity: number;
  ingredients?: {
    ingredientId: string;
    quantity: number;
  }[];
  components?: {
    componentId: string;
    quantity: number;
  }[];
  variantGroups?: Omit<ProductVariantGroup, "id">[];
}): Promise<Product> {
  const response = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "Error al crear el producto",
    );
  }
  return response.json();
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    image?: string;
    categoryId?: string;
    locationId?: string;
    isActive?: boolean;
    isIntermediate?: boolean;
    unit?: string;
    quantity?: number;
    ingredients?: {
      ingredientId: string;
      quantity: number;
    }[];
    components?: {
      componentId: string;
      quantity: number;
    }[];
    variantGroups?: Omit<ProductVariantGroup, "id">[];
  },
): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "Error al actualizar el producto",
    );
  }
  return response.json();
}

export async function getProductArConfiguration(
  productId: string,
): Promise<ProductArConfiguration> {
  const response = await fetch(`${API_URL}/products/${productId}/ar`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo cargar la configuración AR");
  }
  const data = await response.json();
  return {
    ...data,
    enabled: data.arEnabled,
    model3dUrl: data.model3dUrl,
    modelUsdzUrl: data.modelUsdzUrl,
    thumbnailUrl: data.modelThumbnailUrl,
    scale: data.modelScale,
    placement: data.arPlacement,
  };
}

export async function updateProductArConfiguration(
  productId: string,
  configuration: {
    enabled: boolean;
    model3dUrl?: string | null;
    modelUsdzUrl?: string | null;
    modelThumbnailUrl?: string | null;
    modelScale?: { x: number; y: number; z: number } | null;
    arPlacement?: "floor" | "wall";
  },
): Promise<ProductArConfiguration> {
  const response = await fetch(`${API_URL}/products/${productId}/ar`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(configuration),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo guardar la configuración AR");
  }
  const data = await response.json();
  return {
    ...data,
    enabled: data.arEnabled,
    model3dUrl: data.model3dUrl,
    modelUsdzUrl: data.modelUsdzUrl,
    thumbnailUrl: data.modelThumbnailUrl,
    scale: data.modelScale,
    placement: data.arPlacement,
  };
}

export async function uploadProductArAsset(
  productId: string,
  assetType: "glb" | "usdz" | "thumbnail",
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ProductArConfiguration> {
  const body = new FormData();
  body.append("file", file);
  const data = await new Promise<ProductArAssetResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `${API_URL}/products/${productId}/ar/assets/${assetType}`,
    );
    Object.entries(getAuthHeaders(true)).forEach(([name, value]) => {
      request.setRequestHeader(name, value);
    });
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(
          new Error(
            "La API devolvió una respuesta inválida al cargar el archivo AR",
          ),
        );
        return;
      }
      if (typeof payload !== "object" || payload === null) {
        reject(
          new Error(
            "La API devolvió una respuesta inválida al cargar el archivo AR",
          ),
        );
        return;
      }
      const response = payload as Partial<ProductArAssetResponse> &
        ApiErrorResponse;
      if (request.status < 200 || request.status >= 300) {
        const message = Array.isArray(response.message)
          ? response.message.join(", ")
          : response.message;
        reject(new Error(message || "No se pudo cargar el archivo AR"));
        return;
      }
      if (!isProductArAssetResponse(response)) {
        reject(
          new Error(
            "La API devolvió datos incompletos al cargar el archivo AR",
          ),
        );
        return;
      }
      resolve(response);
    });
    request.addEventListener("error", () => {
      reject(
        new Error("No se pudo conectar con la API para cargar el archivo AR"),
      );
    });
    request.addEventListener("abort", () => {
      reject(new Error("La carga del archivo AR fue cancelada"));
    });
    request.send(body);
  });
  return {
    ...data,
    enabled: data.arEnabled,
    model3dUrl: data.model3dUrl,
    modelUsdzUrl: data.modelUsdzUrl,
    thumbnailUrl: data.modelThumbnailUrl,
    scale: data.modelScale,
    placement: data.arPlacement,
  };
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al eliminar el producto");
  }
}

export async function getOrders(locationId?: string) {
  const url = new URL("/orders", process.env.NEXT_PUBLIC_API_URL);
  if (locationId) {
    url.searchParams.append("locationId", locationId);
  }
  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch orders");
  }
  return response.json();
}

export interface CreateOrderItem {
  productId: string;
  quantity: number;
  variants?: Array<{
    productVariantId?: string;
    id?: string;
    groupName?: string;
  }>;
  variant?: { id: string; name?: string; groupName?: string };
}

export interface CreateOrderData {
  items?: CreateOrderItem[];
  tableId?: string;
  locationId?: string;
  type?: "TABLE" | "TAKEOUT" | "DELIVERY";
  source?: string;
  splitBill?: string[];
}

async function postOrder(
  data: CreateOrderData,
  endpoint: string,
): Promise<{ id: string; total: number }> {
  // Adaptar items con variantes múltiples al formato backend y asegurar que 'variants' siempre es array
  const items = (data.items || []).map((item) => {
    // Si ya tiene 'variants' como array, transformar
    if (Array.isArray(item.variants)) {
      return {
        ...item,
        variants: item.variants.map((v) => ({
          productVariantId: v.productVariantId || v.id,
          groupName: v.groupName || undefined,
        })),
      };
    } else if (item.variant) {
      // Si tiene solo 'variant', transformar a array
      return {
        ...item,
        variants: [
          {
            productVariantId: item.variant.id,
            groupName: item.variant.groupName,
          },
        ],
      };
    }
    // Si no tiene variantes, poner variants como array vacío
    return { ...item, variants: [] };
  });
  const payload = { ...data, items };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to create order");
  }
  return response.json();
}

export async function createOrder(data: CreateOrderData) {
  return postOrder(data, `${API_URL}/orders`);
}

export async function createPosOrder(data: CreateOrderData) {
  return postOrder(data, `${API_URL}/orders/pos`);
}

async function postBillingRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw toBillingRequestError(
      await response.json().catch(() => null),
      response.status,
    );
  }
  return response.json();
}

async function getBillingRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw toBillingRequestError(
      await response.json().catch(() => null),
      response.status,
    );
  }
  return response.json();
}

export class BillingRequestError extends Error {
  constructor(
    message: string,
    readonly billingDocumentId?: string,
    readonly billingStatus?: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = BillingRequestError.name;
  }
}

function toBillingRequestError(
  errorData: unknown,
  status: number,
): BillingRequestError {
  const body =
    typeof errorData === "object" && errorData !== null
      ? (errorData as Record<string, unknown>)
      : {};
  const rawMessage = body.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage
        .filter((value): value is string => typeof value === "string")
        .join(", ")
    : typeof rawMessage === "string"
      ? rawMessage
      : `Billing request failed (${status}).`;
  return new BillingRequestError(
    message,
    typeof body.billingDocumentId === "string"
      ? body.billingDocumentId
      : undefined,
    typeof body.status === "string" ? body.status : undefined,
    typeof body.code === "string" ? body.code : undefined,
  );
}

export async function listBillingDocuments(query: {
  locationId?: string;
  status?: BillingDocumentStatus;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<BillingDocumentsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return getBillingRequest(`/billing/documents${search ? `?${search}` : ""}`);
}

export async function getBillingDocument(
  documentId: string,
): Promise<BillingDocumentDetail> {
  return getBillingRequest(
    `/billing/documents/${encodeURIComponent(documentId)}`,
  );
}

export async function getSalesReport(query: {
  locationId?: string;
  from: string;
  to: string;
}): Promise<SalesReport> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.locationId) params.set("locationId", query.locationId);
  return getBillingRequest(`/reports/sales?${params.toString()}`);
}

export async function issuePosInvoice(
  orderIds: string[],
  customer: BillingCustomerInput,
): Promise<BillingDocumentResult> {
  return postBillingRequest("/billing/pos/orders", { orderIds, customer });
}

export async function issuePosTableInvoice(
  tableId: string,
  orderIds: string[],
  customer: BillingCustomerInput,
): Promise<BillingDocumentResult> {
  return postBillingRequest(
    `/billing/pos/tables/${encodeURIComponent(tableId)}`,
    {
      orderIds,
      customer,
    },
  );
}

export async function issuePosTablePaymentInvoice(
  tableId: string,
  paymentIds: string[],
  customer: BillingCustomerInput,
): Promise<BillingDocumentResult> {
  return postBillingRequest(
    `/billing/pos/tables/${encodeURIComponent(tableId)}/payments`,
    { paymentIds, customer },
  );
}

export async function declinePosTablePaymentInvoice(
  tableId: string,
  paymentIds: string[],
): Promise<void> {
  await postBillingRequest(
    `/billing/pos/tables/${encodeURIComponent(tableId)}/payments/decline`,
    { paymentIds },
  );
}

export async function declinePosTableInvoice(
  tableId: string,
  orderIds: string[],
): Promise<void> {
  await postBillingRequest(
    `/billing/pos/tables/${encodeURIComponent(tableId)}/decline`,
    { orderIds },
  );
}

export async function closePosTableAccount(
  tableId: string,
  allowIncompleteOrders = false,
): Promise<{ tableId: string; closedAt: string; closedOrderCount: number }> {
  const response = await fetch(
    `${API_URL}/tables/${encodeURIComponent(tableId)}/close-account`,
    {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ allowIncompleteOrders }),
    },
  );
  if (!response.ok) {
    const errorData: unknown = await response.json().catch(() => null);
    const message =
      typeof errorData === "object" &&
      errorData !== null &&
      "message" in errorData &&
      typeof errorData.message === "string"
        ? errorData.message
        : `Could not close table account (${response.status}).`;
    throw new Error(message);
  }
  return response.json();
}

export async function retryPosInvoice(
  billingDocumentId: string,
): Promise<BillingDocumentResult> {
  return postBillingRequest(
    `/billing/pos/documents/${encodeURIComponent(billingDocumentId)}/retry`,
  );
}

export async function refreshPosInvoice(
  billingDocumentId: string,
): Promise<BillingDocumentResult> {
  return postBillingRequest(
    `/billing/pos/documents/${encodeURIComponent(billingDocumentId)}/refresh`,
  );
}

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: "PENDING" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED",
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/items/${itemId}/status`,
    {
      method: "PATCH",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to update order item status");
  }
  return response.json();
}

export async function getUser(): Promise<User> {
  const token = getAuthToken();
  if (!token) throw new Error("No authentication token found");

  console.log("[getUser] Making request to:", `${API_URL}/auth/me`);
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  console.log(
    "[getUser] Response status:",
    response.status,
    "ok:",
    response.ok,
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuthToken();
      throw new Error("Authentication expired or invalid");
    }
    const errorText = await response.text();
    console.error("[getUser] Error response:", errorText);
    throw new Error(`Failed to fetch user (${response.status})`);
  }

  const userData = await response.json();
  console.log("[getUser] User data received:", userData);
  return userData;
}

export async function getKitchenOrders(
  locationId?: string,
): Promise<KitchenOrder[]> {
  console.log("Fetching kitchen orders DEEPER...");
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  let url = `${API_URL}/orders?kitchen=true`;
  if (locationId && locationId !== "all") {
    url += `&locationId=${locationId}`;
  }

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  console.log("Response:", response);
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      throw new Error("Authentication expired or invalid");
    }
    throw new Error("Error al obtener las órdenes de cocina");
  }

  const data = await response.json();
  return data;
}

export async function updateKitchenOrderItemStatus(
  itemId: string,
  status: "PENDING" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED",
): Promise<unknown> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(
    `${API_URL}/kitchen/orders/items/${itemId}/status`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      throw new Error("Authentication expired or invalid");
    }
    throw new Error("Error al actualizar el estado del item");
  }
  return response.json();
}

export async function printKitchenTicket(orderId: string): Promise<unknown> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_URL}/kitchen/orders/${orderId}/print`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      throw new Error("Authentication expired or invalid");
    }
    throw new Error("Error al imprimir el ticket de cocina");
  }
  return response.json();
}

export async function getActiveOrders(tableId: string): Promise<ActiveOrder[]> {
  try {
    const response = await fetch(`${API_URL}/orders?tableId=${tableId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || "Error al obtener las órdenes activas",
      );
    }

    const orders = await response.json();
    console.log(
      `Received ${Array.isArray(orders) ? orders.length : 0} orders for table ${tableId}`,
    );
    return orders;
  } catch (error) {
    console.error("Error fetching active orders:", error);
    throw error;
  }
}

export interface TableShift {
  id: string;
  tenantId: string;
  locationId: string;
  startedAt: string;
  endedAt: string | null;
  openingCash: number;
  openedBy?: { id: string; firstName: string; lastName: string } | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface PosShiftStatus {
  shift: TableShift | null;
  defaultOpeningCash: number;
}

export interface PosShiftSummary {
  shift: TableShift;
  expectedAmounts: Record<PaymentMethod, number>;
  orderCount: number;
  paymentCount: number;
  collectedTotal: number;
}

export interface TableShiftActivityOrder {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  isPaid: boolean;
  paymentMethod: string | null;
  customerName: string | null;
  total: number | null;
  user?: { firstName: string; lastName: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    price: number | null;
    status: string;
    product: { name: string; price: number };
    variants: Array<{
      groupName: string | null;
      productVariant: { name: string; price: number; image: string | null };
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
  }>;
  tableAccountSession: {
    id: string;
    startedAt: string;
    endedAt: string;
    orderCount: number;
    total: number;
  } | null;
}

export interface TableShiftActivity {
  shift: TableShift | null;
  orders: TableShiftActivityOrder[];
  openAccountStartedAt: string | null;
  openAccountOrderCount: number;
  openAccountTotal: number;
}

async function getTableApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const errorBody = await response.json().catch(() => ({}));
  const message = Array.isArray(errorBody.message)
    ? errorBody.message.join(", ")
    : errorBody.message;
  return new Error(typeof message === "string" ? message : fallback);
}

export async function settlePosTableAccount(
  tableId: string,
  request: TableSettlementRequest,
): Promise<{ payments: Payment[]; total: number }> {
  const response = await fetch(
    `${API_URL}/pos/tables/${encodeURIComponent(tableId)}/settle`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw await getTableApiError(
      response,
      "No se pudo procesar la cuenta de la mesa",
    );
  }
  return response.json();
}

export async function getPosShiftStatus(
  locationId: string,
): Promise<PosShiftStatus> {
  const response = await fetch(
    `${API_URL}/pos/shifts/status?locationId=${encodeURIComponent(locationId)}`,
    {
      headers: getAuthHeaders(),
    },
  );
  if (!response.ok) {
    throw await getTableApiError(
      response,
      "No se pudo consultar el turno activo",
    );
  }
  return response.json();
}

export async function openPosShift(
  locationId: string,
  openingCash: number,
): Promise<TableShift> {
  const response = await fetch(`${API_URL}/pos/shifts/open`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ locationId, openingCash }),
  });
  if (!response.ok) {
    throw await getTableApiError(response, "No se pudo abrir el turno");
  }
  return response.json();
}

export async function getPosShiftSummary(
  shiftId: string,
): Promise<PosShiftSummary> {
  const response = await fetch(
    `${API_URL}/pos/shifts/${encodeURIComponent(shiftId)}/summary`,
    {
      headers: getAuthHeaders(),
    },
  );
  if (!response.ok) {
    throw await getTableApiError(
      response,
      "No se pudo calcular el cierre del turno",
    );
  }
  return response.json();
}

export async function closePosShift(
  shiftId: string,
  declaredAmounts: Record<PaymentMethod, number>,
  discrepancyNote?: string,
): Promise<{
  shift: TableShift | null;
  expectedAmounts: Record<PaymentMethod, number>;
  declaredAmounts: Record<PaymentMethod, number>;
  variance: Record<PaymentMethod, number>;
  orderCount: number;
  paymentCount: number;
  collectedTotal: number;
}> {
  const response = await fetch(
    `${API_URL}/pos/shifts/${encodeURIComponent(shiftId)}/close`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ declaredAmounts, discrepancyNote }),
    },
  );
  if (!response.ok) {
    throw await getTableApiError(response, "No se pudo cerrar el turno");
  }
  return response.json();
}

export async function getTableShiftActivity(
  tableId: string,
): Promise<TableShiftActivity> {
  const response = await fetch(`${API_URL}/tables/${tableId}/shift-activity`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw await getTableApiError(
      response,
      "No se pudo cargar la actividad de la mesa",
    );
  }
  return response.json();
}

export async function getOrderPaymentDetails(
  orderId: string,
): Promise<PaymentDetails> {
  const response = await fetch(`${API_URL}/payments/orders/${orderId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Error al obtener los detalles de pago de la orden");
  }

  return response.json();
}

export async function processPayment(
  orderId: string,
  amount: number,
  method: PaymentMethod,
): Promise<Payment> {
  const response = await fetch(`${API_URL}/payments/process`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      amount,
      method,
    }),
  });

  if (!response.ok) {
    throw new Error("Error al procesar el pago");
  }

  return response.json();
}

// User API functions
export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

export async function getUserAccessRequests(): Promise<UserAccessRequest[]> {
  const response = await fetch(`${API_URL}/users/access-requests`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok)
    throw new Error("No se pudieron cargar las solicitudes de acceso");
  return response.json();
}

export async function approveUserAccessRequest(
  id: string,
  role: string,
): Promise<User> {
  const response = await fetch(
    `${API_URL}/users/access-requests/${id}/approve`,
    {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
      credentials: "include",
    },
  );
  if (!response.ok) throw new Error("No se pudo aprobar la solicitud");
  return response.json();
}

export async function rejectUserAccessRequest(id: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/users/access-requests/${id}/reject`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      credentials: "include",
    },
  );
  if (!response.ok) throw new Error("No se pudo rechazar la solicitud");
}

export async function createUser(data: CreateUserDto): Promise<User> {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to create user");
  return response.json();
}

export async function updateUser(
  id: string,
  data: UpdateUserDto,
): Promise<User> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to update user");
  return response.json();
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al eliminar el usuario");
  }
}

export async function getCustomers(): Promise<Customer[]> {
  const response = await fetch(`${API_URL}/customers`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Error al obtener los clientes");
  }
  return response.json();
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    phone?: string;
    address?: string;
    neighborhood?: string;
    whatsappId?: string;
    locationId?: string;
  },
): Promise<unknown> {
  const response = await fetch(`${API_URL}/customers/${id}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Error al actualizar el cliente");
  }

  return response.json();
}

export async function updateCategoryOrder(orderedIds: string[]) {
  const response = await fetch(`${API_URL}/categories/order`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderedIds }),
  });
  if (!response.ok) {
    throw new Error("Failed to update category order");
  }
  return response.json();
}

export interface ProduceProductPayload {
  productId: string;
  quantity: number;
  wasteQuantity?: number;
  wasteNotes?: string;
}

export interface ProductionLog {
  id: string;
  number: number;
  productId: string;
  productCode: string | null;
  productName: string | null;
  productUnit: string | null;
  createdById: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  quantity: number;
  wasteQuantity: number;
  wasteNotes?: string | null;
  consumedMaterials: Array<{
    id: string;
    code: string;
    name: string;
    unit: string;
    quantity: number;
    type: "INGREDIENT" | "PRODUCT";
  }>;
  createdAt: string;
  product: Pick<
    Product,
    "id" | "code" | "name" | "unit" | "locationId" | "location"
  >;
}

export async function getProductionHistory(
  locationId?: string,
): Promise<ProductionLog[]> {
  const searchParams = new URLSearchParams();
  if (locationId) searchParams.set("locationId", locationId);

  const response = await fetch(
    `${API_URL}/production${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    { headers: getAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error("No se pudo cargar el historial de producción");
  }
  return response.json();
}

export async function produceProduct(data: ProduceProductPayload) {
  const response = await fetch(`${API_URL}/production/produce`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const responseMessage = errorBody?.message;
    const baseMessage =
      typeof responseMessage === "string"
        ? responseMessage
        : responseMessage?.message || "Error al registrar la producción";
    const missing = responseMessage?.missing as
      | { name: string; required: number; available: number }[]
      | undefined;
    const message = missing?.length
      ? `${baseMessage}: ${missing
          .map(
            (item) =>
              `${item.name}: requiere ${item.required}, disponibles ${item.available}`,
          )
          .join("; ")}`
      : baseMessage;
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }

  return response.json();
}
