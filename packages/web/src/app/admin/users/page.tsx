import { UsersManager } from "@/components/admin/users/users-manager"

export default function UsersPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h2>
        <p className="text-muted-foreground">
          Administra los usuarios del sistema y sus roles
        </p>
      </div>
      <UsersManager />
    </div>
  )
}