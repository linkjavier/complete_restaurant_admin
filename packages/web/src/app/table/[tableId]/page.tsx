"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Menu } from "@/components/table/menu"
import { Cart } from "@/components/table/cart"
import { Bell } from "lucide-react"

export default function TablePage({ params }: { params: { tableId: string } }) {
  const [customerName, setCustomerName] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleStartOrder = () => {
    if (customerName.trim()) {
      setShowMenu(true)
    }
  }

  const handleCallWaiter = () => {
    // Implementar lógica para llamar al mesero
    console.log("Llamando al mesero...")
  }

  return (
    <div className="container mx-auto p-4">
      {!showMenu ? (
        <div className="max-w-md mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Bienvenido a la Mesa {params.tableId}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Tu Nombre
                </label>
                <Input
                  id="name"
                  placeholder="Ingresa tu nombre"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <Button onClick={handleStartOrder} disabled={!customerName.trim()}>
                  Comenzar Pedido
                </Button>
                <Button variant="outline" onClick={() => setIsLoggedIn(true)}>
                  Iniciar Sesión con Redes Sociales
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Mesa {params.tableId}</h1>
            <Button variant="outline" onClick={handleCallWaiter}>
              <Bell className="mr-2 h-4 w-4" />
              Llamar al Mesero
            </Button>
          </div>
          <Tabs defaultValue="menu" className="space-y-4">
            <TabsList>
              <TabsTrigger value="menu">Menú</TabsTrigger>
              <TabsTrigger value="cart">Carrito</TabsTrigger>
            </TabsList>
            <TabsContent value="menu">
              <Menu />
            </TabsContent>
            <TabsContent value="cart">
              <Cart customerName={customerName} tableId={params.tableId} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
} 