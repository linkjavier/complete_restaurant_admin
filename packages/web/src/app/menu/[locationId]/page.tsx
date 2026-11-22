"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Minus, Plus, Search, ShoppingBag, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getPublicQrMenu, PublicQrMenu, QrMenuProduct } from "@/lib/api"
import { ArProductViewer } from "@/components/qr-menu/ar-product-viewer"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

export default function PublicQrMenuPage() {
  const params = useParams<{ locationId: string }>()
  const locationId = params.locationId
  const [menu, setMenu] = useState<PublicQrMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [search, setSearch] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [selectedArProduct, setSelectedArProduct] = useState<QrMenuProduct | null>(null)

  useEffect(() => {
    let active = true
    getPublicQrMenu(locationId)
      .then((data) => {
        if (active) setMenu(data)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el menú")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [locationId])

  const categories = useMemo(() => {
    if (!menu) return []
    const categoriesById = new Map<string, { id: string; name: string }>()
    menu.products.forEach((product) => {
      const category = product.category
      if (category?.id) categoriesById.set(category.id, { id: category.id, name: category.name })
    })
    return Array.from(categoriesById.values())
  }, [menu])

  const visibleProducts = useMemo(() => {
    if (!menu) return []
    const term = search.trim().toLocaleLowerCase()
    return menu.products.filter((product) => (
      (categoryId === "all" || product.categoryId === categoryId) &&
      (!term || product.name.toLocaleLowerCase().includes(term) ||
        product.description?.toLocaleLowerCase().includes(term))
    ))
  }, [menu, categoryId, search])

  const cartItems = useMemo(() => (
    menu?.products
      .filter((product) => (cart[product.id] || 0) > 0)
      .map((product) => ({ product, quantity: cart[product.id] })) || []
  ), [menu, cart])
  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const updateQuantity = (productId: string, delta: number) => {
    setCart((current) => {
      const quantity = Math.max(0, (current[productId] || 0) + delta)
      const next = { ...current }
      if (quantity) next[productId] = quantity
      else delete next[productId]
      return next
    })
  }

  const whatsappUrl = useMemo(() => {
    if (!menu || !cartItems.length) return ""
    const phone = menu.whatsappPhone.replace(/\D/g, "")
    if (!phone) return ""
    const lines = [
      `Hola, quiero hacer un pedido en ${menu.name}.`,
      customerName.trim() ? `Nombre: ${customerName.trim()}` : "",
      "",
      ...cartItems.map(({ product, quantity }) => `${quantity} x ${product.name} - ${money.format(product.price * quantity)}`),
      "",
      `Total: ${money.format(total)}`,
      `Sucursal: ${menu.location.name}`,
    ].filter(Boolean)
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`
  }, [menu, cartItems, customerName, total])

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando menú…</main>
  }

  if (error || !menu) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Menú no disponible</h1>
          <p className="mt-2 text-muted-foreground">{error || "No se encontró este menú."}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-stone-50 text-stone-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
          {menu.logo && (
            <Image
              src={menu.logo}
              alt={`Logo de ${menu.name}`}
              width={64}
              height={64}
              unoptimized
              className="h-14 w-14 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold sm:text-2xl">{menu.name}</h1>
            <p className="break-words text-sm text-stone-500">{menu.location.name}</p>
          </div>
          {menu.orderingEnabled && itemCount > 0 && (
            <a href="#cart" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: menu.primaryColor }}>
              <ShoppingBag className="h-4 w-4" />
              <span>{itemCount}</span>
            </a>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-8 px-4 py-6 sm:px-6">
        {!!menu.banners.length && (
          <section aria-label="Promociones" className="grid min-w-0 gap-4 sm:grid-cols-2">
            {menu.banners.map((banner) => (
              <article
                key={`${banner.title}-${banner.order}`}
                className="relative isolate flex min-h-40 min-w-0 flex-col justify-end overflow-hidden rounded-2xl bg-stone-900 p-5 text-white sm:p-6"
                style={banner.imageUrl ? {
                  backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.76), rgba(0,0,0,.12)), url("${banner.imageUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                } : { background: `linear-gradient(125deg, ${menu.primaryColor}, #1c1917)`}}
              >
                <p className="mb-2 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">Promoción</p>
                <h2 className="break-words text-2xl font-bold">{banner.title}</h2>
                {banner.description && <p className="mt-1 max-w-2xl break-words text-sm text-white/90">{banner.description}</p>}
              </article>
            ))}
          </section>
        )}

        <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Nuestro menú</h2>
                <p className="mt-1 text-sm text-stone-500">Productos disponibles en {menu.location.name}</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar en el menú"
                  className="bg-white pl-9"
                  aria-label="Buscar productos"
                />
              </div>
            </div>

            <nav aria-label="Categorías" className="mb-6 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2">
              <button
                type="button"
                onClick={() => setCategoryId("all")}
                className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium"
                style={categoryId === "all" ? { backgroundColor: menu.primaryColor, borderColor: menu.primaryColor, color: "white" } : undefined}
              >
                Todos
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium"
                  style={categoryId === category.id ? { backgroundColor: menu.primaryColor, borderColor: menu.primaryColor, color: "white" } : undefined}
                >
                  {category.name}
                </button>
              ))}
            </nav>

            {visibleProducts.length ? (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <article key={product.id} className="min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm">
                    {product.image && (
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={480}
                        height={240}
                        unoptimized
                        className="h-44 w-full object-cover"
                      />
                    )}
                    <div className="min-w-0 space-y-3 p-4">
                      <div>
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <h3 className="min-w-0 break-words font-semibold">{product.name}</h3>
                          <span className="shrink-0 font-bold" style={{ color: menu.primaryColor }}>{money.format(product.price)}</span>
                        </div>
                        {product.category && <p className="text-xs font-medium text-stone-500">{product.category.name}</p>}
                        {product.description && <p className="mt-2 line-clamp-3 break-words text-sm text-stone-600 [overflow-wrap:anywhere]">{product.description}</p>}
                      </div>
                      {product.ar && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => setSelectedArProduct(product)}
                          style={{ borderColor: menu.primaryColor, color: menu.primaryColor }}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Ver en 3D y realidad aumentada
                        </Button>
                      )}
                      {menu.orderingEnabled && (
                        <div className="flex items-center justify-between border-t pt-3">
                          <span className="text-sm text-stone-500">Agregar al pedido</span>
                          {(cart[product.id] || 0) ? (
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateQuantity(product.id, -1)} aria-label={`Quitar ${product.name}`} className="rounded-full border p-1.5">
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="min-w-4 text-center text-sm font-semibold">{cart[product.id]}</span>
                              <button type="button" onClick={() => updateQuantity(product.id, 1)} aria-label={`Agregar otro ${product.name}`} className="rounded-full border p-1.5 text-white" style={{ backgroundColor: menu.primaryColor, borderColor: menu.primaryColor }}>
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => updateQuantity(product.id, 1)} style={{ backgroundColor: menu.primaryColor }}>
                              <Plus className="mr-1 h-4 w-4" /> Agregar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border bg-white p-8 text-center text-stone-500">
                {menu.products.length ? "No encontramos productos para esta búsqueda." : "Pronto publicaremos nuestros productos."}
              </p>
            )}
          </section>

          {menu.orderingEnabled && (
            <aside id="cart" className="min-w-0 scroll-mt-6 rounded-xl border bg-white p-5 shadow-sm lg:sticky lg:top-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ShoppingBag className="h-5 w-5" style={{ color: menu.primaryColor }} />
                Tu pedido
              </h2>
              {cartItems.length ? (
                <>
                  <div className="mt-4 space-y-3">
                    {cartItems.map(({ product, quantity }) => (
                      <div key={product.id} className="flex items-start justify-between gap-3 border-b pb-3">
                        <div className="min-w-0">
                          <p className="font-medium">{quantity} × {product.name}</p>
                          <p className="text-sm text-stone-500">{money.format(product.price * quantity)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => updateQuantity(product.id, -1)} aria-label={`Quitar ${product.name}`} className="rounded-full border p-1">
                            <Minus className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => updateQuantity(product.id, 1)} aria-label={`Agregar otro ${product.name}`} className="rounded-full border p-1">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="my-4 space-y-3">
                    <label htmlFor="customer-name" className="text-sm font-medium">Tu nombre (opcional)</label>
                    <Input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nombre para el pedido" />
                    <div className="flex justify-between font-bold">
                      <span>Total estimado</span>
                      <span>{money.format(total)}</span>
                    </div>
                  </div>
                  {whatsappUrl ? (
                    <Button asChild className="w-full text-white" style={{ backgroundColor: menu.primaryColor }}>
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp</a>
                    </Button>
                  ) : (
                    <p className="text-sm text-red-600">El negocio aún no tiene un número de WhatsApp válido configurado.</p>
                  )}
                  <p className="mt-2 text-center text-xs text-stone-500">El pedido se confirma directamente con el negocio.</p>
                </>
              ) : (
                <p className="mt-3 text-sm text-stone-500">Agrega productos para preparar tu pedido.</p>
              )}
            </aside>
          )}
        </div>
      </div>

      <footer className="mt-12 bg-stone-900 text-stone-100">
        <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 px-4 py-8 sm:grid-cols-2 sm:px-6">
          <div>
            <h2 className="break-words text-lg font-bold">{menu.name}</h2>
            <p className="mt-1 break-words text-sm text-stone-300">{menu.location.name}</p>
          </div>
          <address className="min-w-0 space-y-1 break-words text-sm not-italic text-stone-300 sm:text-right">
            <p>{menu.location.address}{menu.location.city ? `, ${menu.location.city}` : ""}{menu.location.country ? `, ${menu.location.country}` : ""}</p>
            <a href={`tel:${menu.location.phone}`} className="underline">{menu.location.phone}</a>
          </address>
          <p className="text-xs text-stone-500 sm:col-span-2">© {new Date().getFullYear()} {menu.name}</p>
        </div>
      </footer>
      <Dialog
        open={!!selectedArProduct}
        onOpenChange={(open) => !open && setSelectedArProduct(null)}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-3xl p-4 sm:p-6">
          {selectedArProduct?.ar && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedArProduct.name}</DialogTitle>
                <DialogDescription>
                  Explora el producto en 3D o usa el botón del visor para colocarlo en tu espacio con realidad aumentada.
                </DialogDescription>
              </DialogHeader>
              <ArProductViewer
                productName={selectedArProduct.name}
                experience={selectedArProduct.ar}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
