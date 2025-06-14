"use client"

import { useState, useEffect } from 'react'
import { TablesManager } from "@/components/admin/tables/tables-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Custom hook for mobile viewport height
function useMobileViewportHeight() {
  const [vh, setVh] = useState('100vh');

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setVh(`${window.innerHeight}px`);
    };

    updateHeight();

    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('scroll', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('scroll', updateHeight);
    };
  }, []);

  return vh;
}

export default function TablesPage() {
  const vh = useMobileViewportHeight();

  return (
    <div 
      className="min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] w-full overflow-x-hidden"
      style={{ minHeight: vh }}
    >
      <div className="container relative flex w-full min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] flex-col items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Gestión de Mesas</CardTitle>
          </CardHeader>
          <CardContent>
            <TablesManager />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 