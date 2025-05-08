"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function NotificationsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {/* Badge will be added here later */}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
          No notifications yet
        </div>
      </DialogContent>
    </Dialog>
  )
}
