"use client";

import { InventoryManager } from "@/components/admin/inventory/inventory-manager";

export default function InventoryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 sm:mb-7">
        <p className="text-sm font-medium text-primary">
          Control de existencias
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Inventarios
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Revisa ingredientes, preparaciones y productos terminados en un solo
          lugar.
        </p>
      </header>
      <InventoryManager />
    </div>
  );
}
