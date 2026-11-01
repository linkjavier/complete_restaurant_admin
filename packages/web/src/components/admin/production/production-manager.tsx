"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getProducts, produceProduct, Product } from "@/lib/api"

export function ProductionManager() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [wasteQuantity, setWasteQuantity] = useState(0)
  const [wasteNotes, setWasteNotes] = useState("")

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const data = await getProducts()
        setProducts(
          data.filter(
            (p) => p.isActive && p.ingredients && p.ingredients.length > 0,
          ),
        )
      } catch (err) {
        console.error("Error fetching products:", err)
        toast({
          title: "Error",
          description: "No se pudieron cargar los productos",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [toast])

  const handleSubmit = async () => {
    if (!productId || quantity <= 0) {
      toast({
        title: "Error",
        description: "Selecciona un producto y una cantidad válida",
        variant: "destructive",
      })
      return
    }

    if (wasteQuantity < 0) {
      toast({
        title: "Error",
        description: "La merma no puede ser negativa",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      await produceProduct({
        productId,
        quantity,
        wasteQuantity: wasteQuantity > 0 ? wasteQuantity : undefined,
        wasteNotes: wasteNotes.trim() || undefined,
      })

      toast({
        title: "Éxito",
        description: "Producción registrada correctamente",
      })

      setQuantity(1)
      setWasteQuantity(0)
      setWasteNotes("")
    } catch (err) {
      console.error("Error producing product:", err)
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Error al registrar la producción",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Cargando productos...</p>
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product">Producto a producir</Label>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger id="product">
            <SelectValue placeholder="Selecciona un producto" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">Cantidad producida</Label>
        <Input
          id="quantity"
          type="number"
          min={0.01}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wasteQuantity">Merma / residuo (opcional)</Label>
        <Input
          id="wasteQuantity"
          type="number"
          min={0}
          step="any"
          value={wasteQuantity}
          onChange={(e) => setWasteQuantity(parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wasteNotes">Notas de merma (opcional)</Label>
        <Textarea
          id="wasteNotes"
          placeholder="Ej: recorte, derrame, producto dañado..."
          value={wasteNotes}
          onChange={(e) => setWasteNotes(e.target.value)}
        />
      </div>

      <Button onClick={handleSubmit} disabled={submitting || !productId}>
        {submitting ? "Registrando..." : "Registrar producción"}
      </Button>
    </div>
  )
}
