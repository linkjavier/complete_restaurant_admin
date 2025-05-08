"use client"

import { Bell } from "lucide-react"
import { UserMenu } from "./user-menu"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function UserNav() {
  return (
    <div className="flex items-center gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {/* Aquí podrás añadir un badge con el número de notificaciones cuando implementes esa funcionalidad */}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificaciones</DialogTitle>
          </DialogHeader>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No hay notificaciones
          </div>
        </DialogContent>
      </Dialog>
      <UserMenu />
    </div>
  )
}