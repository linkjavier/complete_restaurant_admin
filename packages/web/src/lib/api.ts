const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  categoryId: string;
  category?: Category;
  isActive: boolean;
  locationId?: string;
  ingredients?: ProductIngredient[];
  createdAt?: string;
  updatedAt?: string;
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

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  locationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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

export async function createLocation(data: { name: string }): Promise<Location> {
  const response = await fetch(`${API_URL}/locations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al crear la ubicación');
  }
  return response.json();
}

export async function updateLocation(id: string, data: { name: string }): Promise<Location> {
  const response = await fetch(`${API_URL}/locations/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al actualizar la ubicación');
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
    throw new Error("Error al crear el ingrediente")
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

export async function createProduct(data: {
  name: string
  description?: string
  price: number
  image?: string
  categoryId: string
  locationId: string
  isActive: boolean
  ingredients?: {
    ingredientId: string
    quantity: number
  }[]
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
    throw new Error("Error al crear el producto")
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
  ingredients?: {
    ingredientId: string
    quantity: number
  }[]
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
    throw new Error("Error al actualizar el producto")
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

export async function createOrder(data: {
  tableId: string;
  locationId: string;
  userId?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
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

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Remove invalid token
      localStorage.removeItem('token');
      throw new Error("Authentication expired or invalid");
    }
    throw new Error("Failed to fetch user");
  }

  return response.json();
}

export async function getKitchenOrders(): Promise<any[]> {
  console.log("Fetching kitchen orders DEEPER...")
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }
  
  const response = await fetch(`${API_URL}/orders`, {
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
  return response.json();
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