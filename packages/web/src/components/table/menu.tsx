"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus } from "lucide-react"

interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
}

const mockProducts: Product[] = [
  // Entradas
  {
    id: "e1",
    name: "Nachos con Queso",
    description: "Tortillas chips bañadas en queso fundido, jalapeños y guacamole",
    price: 8.99,
    image: "/images/nachos.jpg",
    category: "Entradas",
  },
  {
    id: "e2",
    name: "Alitas BBQ",
    description: "Alitas de pollo bañadas en salsa BBQ, acompañadas de apio y aderezo ranch",
    price: 12.99,
    image: "/images/alitas.jpg",
    category: "Entradas",
  },
  {
    id: "e3",
    name: "Ceviche Mixto",
    description: "Pescado, camarones y calamares marinados en limón, cebolla y ají",
    price: 14.99,
    image: "/images/ceviche.jpg",
    category: "Entradas",
  },

  // Platos Fuertes
  {
    id: "p1",
    name: "Lomo Saltado",
    description: "Lomo de res salteado con cebolla, tomate y papas fritas",
    price: 18.99,
    image: "/images/lomo.jpg",
    category: "Platos Fuertes",
  },
  {
    id: "p2",
    name: "Pasta Alfredo",
    description: "Fettuccine con salsa cremosa de queso parmesano y pollo",
    price: 16.99,
    image: "/images/pasta.jpg",
    category: "Platos Fuertes",
  },
  {
    id: "p3",
    name: "Parrillada Mixta",
    description: "Selección de carnes a la parrilla con guarniciones",
    price: 24.99,
    image: "/images/parrillada.jpg",
    category: "Platos Fuertes",
  },

  // Desayunos
  {
    id: "d1",
    name: "Desayuno Americano",
    description: "Huevos, tocino, pan tostado, papas y café",
    price: 12.99,
    image: "/images/desayuno-americano.jpg",
    category: "Desayunos",
  },
  {
    id: "d2",
    name: "Omelette del Chef",
    description: "Omelette con jamón, queso, champiñones y espinacas",
    price: 10.99,
    image: "/images/omelette.jpg",
    category: "Desayunos",
  },
  {
    id: "d3",
    name: "Pancakes con Frutas",
    description: "Pancakes esponjosos con frutas frescas y sirope de maple",
    price: 9.99,
    image: "/images/pancakes.jpg",
    category: "Desayunos",
  },

  // Bebidas
  {
    id: "b1",
    name: "Limonada Casera",
    description: "Limonada fresca con menta y jengibre",
    price: 4.99,
    image: "/images/limonada.jpg",
    category: "Bebidas",
  },
  {
    id: "b2",
    name: "Mojito",
    description: "Ron, menta, limón, azúcar y soda",
    price: 8.99,
    image: "/images/mojito.jpg",
    category: "Bebidas",
  },
  {
    id: "b3",
    name: "Café Latte",
    description: "Café espresso con leche vaporizada",
    price: 4.99,
    image: "/images/latte.jpg",
    category: "Bebidas",
  },

  // Panadería
  {
    id: "pa1",
    name: "Croissant de Chocolate",
    description: "Croissant relleno de chocolate belga",
    price: 3.99,
    image: "/images/croissant.jpg",
    category: "Panadería",
  },
  {
    id: "pa2",
    name: "Pan de Ajo",
    description: "Pan artesanal con mantequilla de ajo y perejil",
    price: 5.99,
    image: "/images/pan-ajo.jpg",
    category: "Panadería",
  },
  {
    id: "pa3",
    name: "Muffin de Arándanos",
    description: "Muffin casero con arándanos frescos",
    price: 3.99,
    image: "/images/muffin.jpg",
    category: "Panadería",
  },

  // Postres
  {
    id: "po1",
    name: "Tiramisú",
    description: "Postre italiano con café, mascarpone y cacao",
    price: 7.99,
    image: "/images/tiramisu.jpg",
    category: "Postres",
  },
  {
    id: "po2",
    name: "Cheesecake de Frutos Rojos",
    description: "Cheesecake cremoso con salsa de frutos rojos",
    price: 8.99,
    image: "/images/cheesecake.jpg",
    category: "Postres",
  },
  {
    id: "po3",
    name: "Brownie con Helado",
    description: "Brownie caliente con helado de vainilla y salsa de chocolate",
    price: 7.99,
    image: "/images/brownie.jpg",
    category: "Postres",
  },
]

export function Menu() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState("")

  const categories = ["all", ...new Set(mockProducts.map((p) => p.category))]

  const filteredProducts = mockProducts.filter((product) => {
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <Input
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap"
            >
              {category === "all" ? "Todos" : category}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => (
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
  )
} 