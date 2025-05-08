"use client"

import { Sidebar } from "@/components/admin/sidebar"
import { UserNav } from "@/components/user-nav"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Create a client
const queryClient = new QueryClient()

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-full">
        <div className="hidden md:flex h-full w-72 flex-col fixed inset-y-0 z-50">
          <Sidebar />
        </div>
        <div className="fixed top-0 right-0 left-0 md:left-72 h-16 bg-white border-b z-40 flex items-center px-4">
          <div className="ml-auto">
            <UserNav />
          </div>
        </div>
        <main className="md:pl-72 pt-16 h-full">
          {children}
        </main>
      </div>
    </QueryClientProvider>
  )
}