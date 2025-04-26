"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus } from "lucide-react"
import { getProducts, Product, Category } from "@/lib/api"
import { Cart } from "./cart"

interface MenuProps {
  locationId: string
  tableId: string
  customerName: string
}

export function Menu({ locationId, tableId, customerName }: MenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const data = await getProducts(
          locationId,
          selectedCategory === "all" ? undefined : selectedCategory,
          searchTerm || undefined
        )
        setProducts(data)
      } catch (err) {
        setError("Error al cargar los productos")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [locationId, selectedCategory, searchTerm])

  // Extraer categorías únicas de los productos
  const categoriesMap = new Map<string, Category>();
  
  // Mapear categorías de productos para generar lista única
  products.forEach(product => {
    if (product.category && product.categoryId) {
      categoriesMap.set(product.categoryId, product.category);
    }
  });
  
  // Lista final de categorías para el menú
  const categories = ["all", ...Array.from(categoriesMap.keys())];

  const handleAddToCart = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }))
  }

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId] -= 1
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const cartItems = Object.entries(cart).map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return null
    return {
      id: productId,
      product,
      quantity,
      price: product.price,
    }
  }).filter(Boolean)

  if (loading) {
    return <div className="text-center">Cargando productos...</div>
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex flex-wrap gap-2">
              {categories.map((categoryId) => (
                <Button
                  key={categoryId}
                  variant={selectedCategory === categoryId ? "default" : "outline"}
                  onClick={() => setSelectedCategory(categoryId)}
                  className="whitespace-nowrap"
                >
                  {categoryId === "all" 
                    ? "Todos" 
                    : (categoriesMap.get(categoryId)?.name || categoryId)
                  }
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle>{product.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {product.description}
                    </p>
                    <p className="font-bold">${product.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveFromCart(product.id)}
                        disabled={!cart[product.id]}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span>{cart[product.id] || 0}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleAddToCart(product.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <div className="md:col-span-1">
        <Cart
          customerName={customerName}
          tableId={tableId}
          locationId={locationId}
          items={cartItems}
          onItemsChange={(newItems) => {
            const newCart: Record<string, number> = {}
            newItems.forEach(item => {
              newCart[item.product.id] = item.quantity
            })
            setCart(newCart)
          }}
        />
      </div>
    </div>
  )
} 