"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { getLocations, Location } from "@/lib/api"

export const ALL_LOCATIONS = "all"
const LOCATION_STORAGE_KEY = "admin-selected-location"

interface LocationSelectionValue {
  locations: Location[]
  selectedLocationId: string
  setSelectedLocationId: (locationId: string) => void
  isLoadingLocations: boolean
}

const LocationSelectionContext = createContext<LocationSelectionValue | null>(null)

export function LocationSelectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_LOCATIONS)
  const [isLoadingLocations, setIsLoadingLocations] = useState(true)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    if (user?.role !== "SUPER_ADMIN") {
      setLocations([])
      setSelectedLocationId(user?.locationId ?? ALL_LOCATIONS)
      setIsLoadingLocations(false)
      setIsReady(true)
      return () => {
        active = false
      }
    }

    setIsReady(false)
    setIsLoadingLocations(true)
    getLocations()
      .then((availableLocations) => {
        if (!active) return
        setLocations(availableLocations)
        const savedLocationId = window.localStorage.getItem(LOCATION_STORAGE_KEY)
        const hasSavedLocation = availableLocations.some(
          (location) => location.id === savedLocationId,
        )
        setSelectedLocationId(
          hasSavedLocation ? savedLocationId ?? ALL_LOCATIONS : ALL_LOCATIONS,
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        console.error("Error loading location selector:", error)
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las ubicaciones.",
        )
        setLocations([])
        setSelectedLocationId(ALL_LOCATIONS)
      })
      .finally(() => {
        if (active) {
          setIsLoadingLocations(false)
          setIsReady(true)
        }
      })

    return () => {
      active = false
    }
  }, [user?.locationId, user?.role])

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN" && isReady) {
      window.localStorage.setItem(LOCATION_STORAGE_KEY, selectedLocationId)
    }
  }, [isReady, selectedLocationId, user?.role])

  return (
    <LocationSelectionContext.Provider
      value={{
        locations,
        selectedLocationId,
        setSelectedLocationId,
        isLoadingLocations,
      }}
    >
      {children}
    </LocationSelectionContext.Provider>
  )
}

export function useLocationSelection() {
  const context = useContext(LocationSelectionContext)
  if (!context) {
    throw new Error("useLocationSelection must be used within LocationSelectionProvider")
  }
  return context
}
