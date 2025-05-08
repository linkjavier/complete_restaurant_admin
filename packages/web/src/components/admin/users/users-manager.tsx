"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getUsers, createUser, deleteUser, updateUser } from "@/lib/api"
import { getLocations } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageUpload } from "../products/image-upload"

const USER_ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "CHEF", label: "Chef" },
  { value: "WAITER", label: "Mesero" },
  { value: "CASHIER", label: "Cajero" },
  { value: "STAFF", label: "Staff" },
  { value: "MANAGER", label: "Gerente" },
  { value: "CUSTOMER", label: "Cliente" },
]

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locationId: string | null;
  avatar: string | null;
}

interface Location {
  id: string;
  name: string;
}

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "",
    locationId: "",
    avatar: "",
  })
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const { toast } = useToast()
  const { user: currentUser } = useAuth()

  useEffect(() => {
    fetchUsers()
    fetchLocations()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError("Error al cargar los usuarios. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const data = await getLocations()
      setLocations(data)
    } catch (err) {
      console.error('Error fetching locations:', err)
    }
  }

  const handleCreateUser = async () => {
    try {
      if (!newUser.email || !newUser.password || !newUser.firstName || !newUser.lastName || !newUser.role) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos requeridos",
          variant: "destructive",
        })
        return
      }

      await createUser({
        email: newUser.email,
        password: newUser.password,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        locationId: newUser.locationId || undefined,
        avatar: newUser.avatar || undefined,
      })

      toast({
        title: "Éxito",
        description: "Usuario creado correctamente",
      })

      setNewUser({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "",
        locationId: "",
        avatar: "",
      })

      fetchUsers()
    } catch (err) {
      console.error('Error creating user:', err)
      toast({
        title: "Error",
        description: "Error al crear el usuario. Por favor, verifica los datos.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      if (!editingUser.email || !editingUser.firstName || !editingUser.lastName || !editingUser.role) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos requeridos",
          variant: "destructive",
        })
        return
      }

      await updateUser(editingUser.id, {
        email: editingUser.email,
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        role: editingUser.role,
        locationId: editingUser.locationId || undefined,
        avatar: editingUser.avatar || undefined,
      })

      toast({
        title: "Éxito",
        description: "Usuario actualizado correctamente",
      })

      setEditingUser(null)
      fetchUsers()
    } catch (err) {
      console.error('Error updating user:', err)
      toast({
        title: "Error",
        description: "Error al actualizar el usuario. Por favor, verifica los datos.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id)
      toast({
        title: "Éxito",
        description: "Usuario eliminado correctamente",
      })
      fetchUsers()
    } catch (err) {
      console.error('Error deleting user:', err)
      toast({
        title: "Error",
        description: "No tienes permisos para eliminar usuarios. Esta acción solo puede ser realizada por un Super Admin.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={editingUser ? editingUser.email : newUser.email}
                onChange={(e) =>
                  editingUser
                    ? setEditingUser({ ...editingUser, email: e.target.value })
                    : setNewUser({ ...newUser, email: e.target.value })
                }
              />
            </div>
            
            {!editingUser && (
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                placeholder="Nombre"
                value={editingUser ? editingUser.firstName : newUser.firstName}
                onChange={(e) =>
                  editingUser
                    ? setEditingUser({ ...editingUser, firstName: e.target.value })
                    : setNewUser({ ...newUser, firstName: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                placeholder="Apellido"
                value={editingUser ? editingUser.lastName : newUser.lastName}
                onChange={(e) =>
                  editingUser
                    ? setEditingUser({ ...editingUser, lastName: e.target.value })
                    : setNewUser({ ...newUser, lastName: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={editingUser ? editingUser.role : newUser.role}
                onValueChange={(value) =>
                  editingUser
                    ? setEditingUser({ ...editingUser, role: value })
                    : setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locationId">Ubicación</Label>
              <Select
                value={editingUser ? editingUser.locationId || "" : newUser.locationId}
                onValueChange={(value) =>
                  editingUser
                    ? setEditingUser({ ...editingUser, locationId: value })
                    : setNewUser({ ...newUser, locationId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Avatar</Label>
              <ImageUpload
                onImageUploaded={(url) => {
                  if (editingUser) {
                    setEditingUser({ ...editingUser, avatar: url })
                  } else {
                    setNewUser({ ...newUser, avatar: url })
                  }
                }}
                currentImage={editingUser ? editingUser.avatar || "" : newUser.avatar}
              />
            </div>

            <div className="flex gap-2">
              {editingUser ? (
                <>
                  <Button onClick={handleUpdateUser}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Usuario
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateUser}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Usuario
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center">Cargando usuarios...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={fetchUsers}>Reintentar</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {users.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay usuarios creados
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {user.avatar && (
                        <div className="relative w-12 h-12">
                          <img
                            src={user.avatar}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="w-full h-full object-cover rounded-full"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Rol: {USER_ROLES.find(r => r.value === user.role)?.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ubicación: {locations.find(loc => loc.id === user.locationId)?.name || "No asignada"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingUser(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {currentUser?.role === 'SUPER_ADMIN' && (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}