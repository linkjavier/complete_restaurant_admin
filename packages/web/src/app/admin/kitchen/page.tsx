"use client";

import { KitchenView } from "@/components/kitchen/kitchen-view";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function KitchenPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== "CHEF" && user.role !== "ADMIN"))) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !user.locationId) {
    return <div>No location assigned</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Kitchen View</h1>
      <KitchenView locationId={user.locationId} />
    </div>
  );
} 