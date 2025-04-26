"use client";

import { KitchenView } from "@/components/kitchen/kitchen-view";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function KitchenPage() {
  const { user } = useAuth();

  if (!user?.locationId) {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Cocina - Vista de Órdenes</CardTitle>
        </CardHeader>
        <CardContent>
          <KitchenView locationId={user.locationId} />
        </CardContent>
      </Card>
    </div>
  );
} 