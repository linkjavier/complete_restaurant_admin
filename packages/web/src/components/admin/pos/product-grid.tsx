"use client"

import { useState } from "react"
import { Product, ProductVariant } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Plus } from "lucide-react"
import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface GroupedProduct {
  categoryName: string;
  categoryId: string;
  products: Product[];
}

interface ProductVariantWithGroup extends ProductVariant {
  groupName?: string;
}

interface ProductGridProps {
  groupedProducts: GroupedProduct[];
  onAddToCart: (product: Product, variants?: ProductVariantWithGroup[] | ProductVariant) => void;
  cart: Record<string, number>;
  showLocationName?: boolean;
}

export const CategoryTitle = ({ title }: { title: string }) => {
  const words = title.split(' ')
  const lastWord = words.pop() || ''
  const firstPart = words.join(' ')

  return (
    <div className="text-center my-6">
      {firstPart && (
        <h2
          className="text-3xl"
          style={{
            fontFamily: "'Anton', sans-serif",
            color: '#c83b3b',
            textTransform: 'uppercase',
            fontWeight: 400,
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}
        >
          {firstPart}
        </h2>
      )}
      <h3
        className="text-5xl"
        style={{
          fontFamily: "'Pacifico', cursive",
          color: '#e58c3d',
          lineHeight: 1.2,
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {lastWord}
      </h3>
    </div>
  )
}

export function ProductGrid({ groupedProducts, onAddToCart, cart, showLocationName = false }: ProductGridProps) {
  const [variantModal, setVariantModal] = useState<{ product: Product | null, open: boolean }>({ product: null, open: false })
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({}) // groupId -> variantId or 'single' for simple

  if (groupedProducts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No se encontraron productos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pt-4">
      {groupedProducts.map(({ categoryId, categoryName, products }) => (
        <div key={categoryId}>
          <CategoryTitle title={categoryName} />
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => {
              const cartKeyWithoutVariant = product.id;
              const cartKeysForProduct = Object.keys(cart).filter(key => key.startsWith(cartKeyWithoutVariant));
              
              const quantity = cartKeysForProduct.reduce((total, key) => total + (cart[key] || 0), 0);
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
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
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
                      {showLocationName && product.location && (
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {product.location.name}
                        </p>
                      )}
                    </div>
                    <div className="flex-none">
                      <Button
                        size="lg"
                        onClick={() => {
                          if (product.variantGroups && product.variantGroups.length > 0) {
                            setVariantModal({ product, open: true })
                            setSelectedVariants({})
                          } else {
                            onAddToCart(product)
                          }
                        }}
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
      ))}
      
      {/* Modal de selección de variantes */}
      <Dialog open={variantModal.open} onOpenChange={open => setVariantModal({ product: variantModal.product, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecciona las variantes</DialogTitle>
          </DialogHeader>
          {variantModal.product && variantModal.product.variantGroups && variantModal.product.variantGroups.length > 0 && (
            <div className="space-y-4">
              {variantModal.product.variantGroups.map((group) => (
                <div key={group.id}>
                  <div className="font-medium text-sm mb-1">{group.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {group.variants.map((variant) => (
                      <Button
                        key={variant.id}
                        variant={selectedVariants[group.id] === variant.id ? 'default' : 'outline'}
                        className="flex items-center gap-2"
                        onClick={() => setSelectedVariants(prev => ({ ...prev, [group.id]: variant.id }))}
                      >
                        {variant.image && (
                          <img src={variant.image} alt={variant.name} className="w-8 h-8 object-cover rounded" />
                        )}
                        <span className="font-medium text-xs">{variant.name}</span>
                        {typeof variant.price === 'number' && !isNaN(variant.price) && (
                          <span className="text-xs text-muted-foreground">${variant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                        )}
                        <Badge variant={variant.isActive ? 'default' : 'secondary'} className="text-[10px]">{variant.isActive ? 'Activa' : 'Inactiva'}</Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (variantModal.product && variantModal.product.variantGroups && variantModal.product.variantGroups.length > 0) {
                  // Validar que todas las variantes estén seleccionadas
                  const allSelected = variantModal.product.variantGroups.every(group => selectedVariants[group.id])
                  if (!allSelected) return
                  // Construir array de variantes seleccionadas
                  const selectedVariantsArr = variantModal.product.variantGroups.map(group => {
                    const variant = group.variants.find(v => v.id === selectedVariants[group.id])
                    return variant ? { ...variant, groupName: group.name } : null
                  }).filter(Boolean)
                  onAddToCart(variantModal.product, selectedVariantsArr)
                  setVariantModal({ product: null, open: false })
                }
              }}
              disabled={
                variantModal.product && variantModal.product.variantGroups && variantModal.product.variantGroups.length > 0
                  ? !variantModal.product.variantGroups.every(group => selectedVariants[group.id])
                  : false
              }
            >
              Agregar al carrito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}