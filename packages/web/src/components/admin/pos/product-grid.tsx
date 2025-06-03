"use client"

import { Product } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Image from "next/image"
import { ImageIcon } from "lucide-react"

interface ProductGridProps {
  products: Product[]
  onAddToCart: (productId: string) => void
  cart: Record<string, number>
}

export function ProductGrid({ products, onAddToCart, cart }: ProductGridProps) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => {
          const quantity = cart[product.id] || 0;
          const isInCart = quantity > 0;

          return (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-square relative">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <CardContent className="p-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-sm font-medium line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                    <p className="text-sm font-medium">${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="flex-none flex items-center justify-center">
                    <Button
                      size="lg"
                      onClick={() => onAddToCart(product.id)}
                      className="h-16 w-16 p-0 rounded-full"
                    >
                      <Plus className="h-8 w-8" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}