function getApiUrl() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }
  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const backendDomain = backendBase.replace(/^https?:\/\//, '');
  const backendProtocol = backendBase.startsWith('https://') ? 'https://' : 'http://';
  const host = window.location.hostname; // gluonico.localhost o gluonico.kutchenbrain.xyz
  const parts = host.split('.');
  const subdomain = (parts.length > 2) ? parts[0] : (parts.length === 2 && parts[1] === 'localhost' ? parts[0] : null);

  // LOCALHOST con subdominio (ej: gluonico.localhost:3001)
  if (host.endsWith('.localhost') && subdomain) {
    return `http://${subdomain}.localhost:3000`;
  }
  // LOCALHOST sin subdominio
  if (host === 'localhost' || host === 'localhost:3000' || host === 'localhost:3001') {
    return 'http://localhost:3000';
  }
  // PRODUCCIÓN con subdominio (ej: gluonico.kutchenbrain.xyz)
  if (subdomain && backendDomain) {
    return `${backendProtocol}${subdomain}.${backendDomain}`;
  }
  // PRODUCCIÓN sin subdominio
  return `${backendProtocol}${backendDomain}`;
}

export const API_URL = getApiUrl();

console.log(process.env.NEXT_PUBLIC_API_URL)
console.log(API_URL)

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

export interface OrderItem {
  id: string
  product: Product
  quantity: number
  price: number
}

export interface Category {
  id: string
  name: string
  description: string | null
  products?: Product[]
  createdAt: string
  updatedAt: string
}

export interface Ingredient {
  id: string
  name: string
  description: string | null
  quantity: number
  unit: string
  minQuantity: number
  locationId: string
  location?: Location
  createdAt: string
  updatedAt: string
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  ingredientId: string
  quantity: number
  unitCost: number
  ingredient?: Ingredient
  createdAt: string
  updatedAt: string
}

export interface Purchase {
  id: string
  tenantId: string
  locationId: string
  supplierName: string
  purchaseDate: string
  totalCost?: number | null
  createdById: string
  createdBy?: User
  location?: Location
  items?: PurchaseItem[]
  createdAt: string
  updatedAt: string
}

export interface ProductIngredient {
  id: string
  productId: string
  ingredientId: string
  quantity: number
  product?: Product
  ingredient?: Ingredient
  createdAt: string
  updatedAt: string
}

export interface ProductComponent {
  id: string
  productId: string
  componentId: string
  quantity: number
  component?: Product
  createdAt: string
  updatedAt: string
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDetails {
  orderId: string;
  orderStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
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
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname; // Ej: gluonico.kutchenbrain.xyz o gluonico.localhost
  const parts = host.split('.');
  if (parts.length >= 2) {
    return parts[0]; // Siempre toma el subdominio
  }
  return null;
};

export const getAuthHeaders = (isMultipart = false) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const tenantId = getTenantIdFromSubdomain();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
  };

  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }

  if (!tenantId) {
    console.warn('[getAuthHeaders] WARNING: No tenantId detected from subdomain! Host:', window.location.hostname);
  } else {
    console.log('[getAuthHeaders] tenantId:', tenantId, 'headers:', headers);
  }
  return headers;
};

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function getProducts(
  locationId?: string,
  categoryId?: string,
  search?: string
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (locationId) params.append('locationId', locationId);
  if (categoryId) params.append('categoryId', categoryId);
  if (search) params.append('search', search);

  const response = await fetch(`${API_URL}/products${params.toString() ? `?${params.toString()}` : ''}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al obtener los productos');
  }
  return response.json();
}

export async function getTable(id: string): Promise<Table> {
  const response = await fetch(`${API_URL}/tables/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al obtener la información de la mesa');
  }
  return response.json();
}

export async function getTables(): Promise<Table[]> {
  const response = await fetch(`${API_URL}/tables`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al obtener las mesas');
  }
  return response.json();
}

export async function createTable(data: Omit<Table, 'id' | 'status' | 'qrCode'>): Promise<Table> {
  const response = await fetch(`${API_URL}/tables`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al crear la mesa');
  }
  return response.json();
}

export async function updateTable(id: string, data: Partial<Omit<Table, 'id' | 'status' | 'qrCode'>>): Promise<Table> {
  const response = await fetch(`${API_URL}/tables/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al actualizar la mesa');
  }
  return response.json();
}

export async function deleteTable(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/tables/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al eliminar la mesa');
  }
}

export async function getLocations(): Promise<Location[]> {
  const response = await fetch(`${API_URL}/locations`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al obtener las ubicaciones');
  }
  return response.json();
}

export async function createLocation(data: {
  name: string;
  address: string;
  phone: string;
  city?: string;
  country?: string;
}): Promise<Location> {
  const response = await fetch(`${API_URL}/locations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al crear la ubicación');
  }
  return response.json();
}

export async function updateLocation(id: string, data: Partial<Omit<Location, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Location> {
  const response = await fetch(`${API_URL}/locations/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar la ubicación');
  }
  return response.json();
}

export async function deleteLocation(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/locations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al eliminar la ubicación');
  }
}

export async function getProduct(id: string): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }
  return response.json();
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/categories`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error("Error al obtener las categorías")
  }
  return response.json()
}

export async function createCategory(data: { name: string; description?: string }): Promise<Category> {
  const response = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error("Error al crear la categoría")
  }
  return response.json()
}

export async function updateCategory(id: string, data: { name: string; description?: string }): Promise<Category> {
  const response = await fetch(`${API_URL}/categories/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error("Error al actualizar la categoría")
  }
  return response.json()
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/categories/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error("Error al eliminar la categoría")
  }
}

export async function getIngredients(): Promise<Ingredient[]> {
  const response = await fetch(`${API_URL}/ingredients`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error("Error al obtener los ingredientes")
  }
  return response.json()
}

export async function createIngredient(data: {
  name: string
  description?: string
  quantity: number
  unit: string
  minQuantity: number
  locationId: string
}): Promise<Ingredient> {
  const response = await fetch(`${API_URL}/ingredients`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message
    throw new Error(message || "Error al crear el ingrediente")
  }
  return response.json()
}

export async function updateIngredient(id: string, data: {
  name?: string
  description?: string
  quantity?: number
  unit?: string
  minQuantity?: number
  locationId?: string
}): Promise<Ingredient> {
  const response = await fetch(`${API_URL}/ingredients/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error("Error al actualizar el ingrediente")
  }
  return response.json()
}

export async function deleteIngredient(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/ingredients/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error("Error al eliminar el ingrediente")
  }
}

export async function getPurchases(params?: {
  fromDate?: string
  toDate?: string
  ingredientId?: string
  locationId?: string
}): Promise<Purchase[]> {
  const searchParams = new URLSearchParams()
  if (params?.fromDate) searchParams.append('fromDate', params.fromDate)
  if (params?.toDate) searchParams.append('toDate', params.toDate)
  if (params?.ingredientId) searchParams.append('ingredientId', params.ingredientId)
  if (params?.locationId) searchParams.append('locationId', params.locationId)

  const url = `${API_URL}/purchases${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('Error al obtener las compras')
  }
  return response.json()
}

export async function createPurchase(data: {
  supplierName: string
  purchaseDate: string
  locationId: string
  totalCost?: number
  items: {
    ingredientId: string
    quantity: number
    unitCost: number
  }[]
}): Promise<Purchase> {
  const response = await fetch(`${API_URL}/purchases`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Error al crear la compra')
  }
  return response.json()
}

export async function createProduct(data: {
  name: string
  description?: string
  price: number
  image?: string
  categoryId: string
  locationId: string
  isActive: boolean
  isIntermediate?: boolean
  unit?: string
  quantity: number
  ingredients?: {
    ingredientId: string
    quantity: number
  }[]
  components?: {
    componentId: string
    quantity: number
  }[]
  variantGroups?: Omit<ProductVariantGroup, 'id'>[]
}): Promise<Product> {
  const response = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "Error al crear el producto",
    )
  }
  return response.json()
}

export async function updateProduct(id: string, data: {
  name?: string
  description?: string
  price?: number
  image?: string
  categoryId?: string
  locationId?: string
  isActive?: boolean
  isIntermediate?: boolean
  unit?: string
  quantity?: number
  ingredients?: {
    ingredientId: string
    quantity: number
  }[]
  components?: {
    componentId: string
    quantity: number
  }[]
  variantGroups?: Omit<ProductVariantGroup, 'id'>[]
}): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "Error al actualizar el producto",
    )
  }
  return response.json()
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error("Error al eliminar el producto")
  }
}

export async function getOrders(locationId?: string) {
  const url = new URL('/orders', process.env.NEXT_PUBLIC_API_URL);
  if (locationId) {
    url.searchParams.append('locationId', locationId);
  }
  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }
  return response.json();
}

export async function createOrder(data: any) {
  // Adaptar items con variantes múltiples al formato backend y asegurar que 'variants' siempre es array
  const items = (data.items || []).map((item: any) => {
    // Si ya tiene 'variants' como array, transformar
    if (Array.isArray(item.variants)) {
      return {
        ...item,
        variants: item.variants.map((v: any) => ({
          productVariantId: v.productVariantId || v.id,
          groupName: v.groupName || undefined,
        })),
      };
    } else if (item.variant) {
      // Si tiene solo 'variant', transformar a array
      return {
        ...item,
        variants: [{ productVariantId: item.variant.id, groupName: item.variant.groupName }],
      };
    }
    // Si no tiene variantes, poner variants como array vacío
    return { ...item, variants: [] };
  });
  const payload = { ...data, items };
  const response = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Failed to create order');
  }
  return response.json();
}

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED',
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/items/${itemId}/status`,
    {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    },
  );
  if (!response.ok) {
    throw new Error('Failed to update order item status');
  }
  return response.json();
}

export async function getUser(): Promise<User> {
  const token = getAuthToken();
  if (!token) throw new Error("No authentication token found");

  console.log('[getUser] Making request to:', `${API_URL}/auth/me`);
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  console.log('[getUser] Response status:', response.status, 'ok:', response.ok);

  if (!response.ok) {
    if (response.status === 401) {
      // Remove invalid token
      localStorage.removeItem('token');
      throw new Error("Authentication expired or invalid");
    }
    const errorText = await response.text();
    console.error('[getUser] Error response:', errorText);
    throw new Error("Failed to fetch user");
  }

  const userData = await response.json();
  console.log('[getUser] User data received:', userData);
  return userData;
}

export async function getKitchenOrders(locationId?: string): Promise<any[]> {
  console.log("Fetching kitchen orders DEEPER...")
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  let url = `${API_URL}/orders?kitchen=true`;
  if (locationId && locationId !== 'all') {
    url += `&locationId=${locationId}`;
  }

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  console.log("Response:", response)
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error("Authentication expired or invalid");
    }
    throw new Error('Error al obtener las órdenes de cocina');
  }

  const data = await response.json();
  return data;
}

export async function updateKitchenOrderItemStatus(
  itemId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED'
): Promise<any> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_URL}/kitchen/orders/items/${itemId}/status`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error("Authentication expired or invalid");
    }
    throw new Error('Error al actualizar el estado del item');
  }
  return response.json();
}

export async function printKitchenTicket(orderId: string): Promise<any> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_URL}/kitchen/orders/${orderId}/print`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error("Authentication expired or invalid");
    }
    throw new Error('Error al imprimir el ticket de cocina');
  }
  return response.json();
}

export async function getActiveOrders(tableId: string) {
  try {
    const response = await fetch(`${API_URL}/orders?tableId=${tableId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Error al obtener las órdenes activas');
    }

    const orders = await response.json();
    console.log(`Received ${Array.isArray(orders) ? orders.length : 0} orders for table ${tableId}`);
    return orders;
  } catch (error) {
    console.error('Error fetching active orders:', error);
    throw error;
  }
}

export async function getOrderPaymentDetails(orderId: string): Promise<PaymentDetails> {
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
  method: PaymentMethod
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
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Failed to fetch users')
  return response.json()
}

export async function createUser(data: CreateUserDto): Promise<User> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Failed to create user')
  return response.json()
}

export async function updateUser(id: string, data: UpdateUserDto): Promise<User> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Failed to update user')
  return response.json()
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al eliminar el usuario');
  }
}

export async function getCustomers(): Promise<any[]> {
  const response = await fetch(`${API_URL}/customers`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error al obtener los clientes');
  }
  return response.json();
}

export async function updateCustomer(id: string, data: {
  name?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  whatsappId?: string;
  locationId?: string;
}): Promise<any> {
  const response = await fetch(`${API_URL}/customers/${id}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Error al actualizar el cliente');
  }

  return response.json();
}

export async function updateCategoryOrder(orderedIds: string[]) {
  const response = await fetch(`${API_URL}/categories/order`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderedIds }),
  });
  if (!response.ok) {
    throw new Error('Failed to update category order');
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
  productId: string;
  quantity: number;
  wasteQuantity: number;
  wasteNotes?: string | null;
  createdAt: string;
  product: Pick<Product, "id" | "name" | "unit" | "locationId" | "location">;
}

export async function getProductionHistory(locationId?: string): Promise<ProductionLog[]> {
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
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const responseMessage = errorBody?.message;
    const baseMessage =
      typeof responseMessage === 'string'
        ? responseMessage
        : responseMessage?.message || 'Error al registrar la producción';
    const missing = responseMessage?.missing as
      | { name: string; required: number; available: number }[]
      | undefined;
    const message =
      missing?.length
        ? `${baseMessage}: ${missing
            .map(
              (item) =>
                `${item.name}: requiere ${item.required}, disponibles ${item.available}`,
            )
            .join("; ")}`
        : baseMessage;
    throw new Error(
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  return response.json();
}
