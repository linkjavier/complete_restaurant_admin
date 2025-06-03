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
            <Card key={product.id} className={`overflow-hidden ${
              isInCart ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950' : ''
            }`}>
              <div className="aspect-[2/1] relative">
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium line-clamp-1 flex-1">{product.name}</h3>
                    {isInCart && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        x{quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                      <p className="text-sm font-medium">${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="flex-none">
                      <Button
                        size="lg"
                        onClick={() => onAddToCart(product.id)}
                        className="h-12 w-12 p-0 rounded-full"
                      >
                        <Plus className="h-6 w-6" />
                      </Button>
                    </div>
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