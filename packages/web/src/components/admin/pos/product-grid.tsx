"use client"

import { Product } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface ProductGridProps {
  products: Product[]
  onAddToCart: (productId: string) => void
  cart: Record<string, number>
}

export function ProductGrid({ products, onAddToCart, cart }: ProductGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const quantity = cart[product.id] || 0;
        const isInCart = quantity > 0;

        return (
          <Card 
            key={product.id} 
            className={`hover:shadow-lg transition-all ${
              isInCart ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950' : ''
            }`}
          >
            <CardHeader>
              <CardTitle className="text-lg flex justify-between items-center">
                {product.name}
                {isInCart && (
                  <span className="text-sm font-normal text-muted-foreground">
                    x{quantity}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {product.image && (
                  <div className="relative w-full h-48">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {product.description}
                </p>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-lg">${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                  <Button
                    size="lg"
                    onClick={() => onAddToCart(product.id)}
                    className="h-12 w-12 p-0 rounded-full"
                  >
                    <Plus className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}