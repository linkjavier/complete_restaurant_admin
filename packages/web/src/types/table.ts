export interface Table {
  id: string
  number: number
  locationId: string
  qrCode: string
  status: 'available' | 'occupied' | 'reserved'
  currentOrderId?: string
}

export interface Order {
  id: string
  tableId: string
  locationId: string
  customerName: string
  customerId?: string
  items: OrderItem[]
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid'
  total: number
  createdAt: Date
  updatedAt: Date
  splitBill?: SplitBill[]
  waiterCall?: boolean
}

export interface OrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  notes?: string
  status: 'pending' | 'preparing' | 'ready' | 'delivered'
}

export interface SplitBill {
  id: string
  customerName: string
  items: OrderItem[]
  total: number
  paid: boolean
} 