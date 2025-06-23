"use client"

import { useEffect, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getCategories, updateCategoryOrder, Category } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { GripVertical } from "lucide-react"

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)")
    const handleMediaQueryChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
    }
    
    // Set the initial state
    setIsDesktop(mediaQuery.matches)

    mediaQuery.addEventListener("change", handleMediaQueryChange)
    
    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange)
    }
  }, [])

  return isDesktop
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id })

  const isDesktop = useIsDesktop()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDesktop ? listeners : {})}
      className="flex items-center bg-background p-3 my-2 rounded-lg border shadow-sm"
    >
      <div
        {...(!isDesktop ? listeners : {})}
        className="mr-2 cursor-grab touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      {children}
    </div>
  )
}

export function CategoryOrderManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [initialOrder, setInitialOrder] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await getCategories()
      setCategories(data)
      setInitialOrder(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las categorías.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSaveChanges = async () => {
    try {
      setSaving(true)
      const orderedIds = categories.map((c) => c.id)
      await updateCategoryOrder(orderedIds)
      setInitialOrder(categories)
      toast({
        title: "Éxito",
        description: "El orden de las categorías ha sido guardado.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el orden de las categorías.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const isOrderChanged = JSON.stringify(categories.map(c => c.id)) !== JSON.stringify(initialOrder.map(c => c.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizar Categorías</CardTitle>
        <CardDescription>
          Arrastra y suelta las categorías para cambiar el orden en que aparecen en el POS, en el menú QR y en toda la gestión de productos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Cargando categorías...</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {categories.map((category) => (
                  <SortableItem key={category.id} id={category.id}>
                    <span className="font-medium">{category.name}</span>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSaveChanges} disabled={!isOrderChanged || saving}>
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 