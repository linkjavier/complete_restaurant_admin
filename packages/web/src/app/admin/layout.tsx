"use client"

import { Sidebar } from "@/components/admin/sidebar"
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
        <main className="md:pl-72 pt-16 h-full">
          {children}
        </main>
      </div>
    </QueryClientProvider>
  )
}