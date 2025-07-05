"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from "@/components/theme-switch";
import React, { useEffect, useState } from "react"
import { API_URL } from '@/lib/api';

const features = [
  {
    title: "Dashboard en Tiempo Real",
    desc: "Control total de tu restaurante con métricas y reportes instantáneos.",
    icon: "/assets/dashboard.svg"
  },
  {
    title: "Asistente de Inteligencia Artificial",
    desc: "Atiende clientes, toma pedidos y responde automáticamente 24/7.",
    icon: "/assets/ai.svg"
  },
  {
    title: "POS y Ventas",
    desc: "Punto de venta rápido, control de caja y facturación fácil.",
    icon: "/assets/pos.svg"
  },
  {
    title: "Gestión de Órdenes y Cocina",
    desc: "Pedidos claros, sin errores y panel especial para chefs y staff.",
    icon: "/assets/orders.svg"
  },
  {
    title: "Inventario e Ingredientes",
    desc: "Controla tu stock, costos y evita pérdidas.",
    icon: "/assets/inventory.svg"
  },
  {
    title: "Multi-Sucursal y Usuarios",
    desc: "Administra todas tus ubicaciones y tu equipo desde un solo lugar.",
    icon: "/assets/multilocation.svg"
  },
  {
    title: "Clientes y CRM",
    desc: "Historial, preferencias y marketing inteligente para tus clientes.",
    icon: "/assets/customers.svg"
  },
  {
    title: "Configuración Flexible",
    desc: "Personaliza la plataforma a tu medida, sin límites.",
    icon: "/assets/settings.svg"
  },
];

export default function HomePage() {
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("Kutchen AI")
  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await fetch(`${API_URL}/settings/business`)
        if (res.ok) {
          const data = await res.json()
          setBusinessIcon(data.logo || "")
          setBusinessName(data.name || "Kutchen AI")
        }
      } catch {}
    }
    fetchBusiness()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20 dark:from-background dark:to-muted/10">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <Image src={businessIcon || "/assets/kutchen_app_logo.png"} alt="Logo KutchenAI" width={48} height={48} />
          <span className="text-2xl font-bold text-foreground">KutchenAI</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitch />
          <Button asChild variant="outline" className="font-semibold">
            <Link href="/auth/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-16 px-4">
        <h1 className="text-5xl md:text-6xl font-extrabold text-foreground max-w-3xl mb-6 leading-tight">
          La IA que revoluciona la gestión de tu restaurante
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-8">
          Si eres dueño de restaurante, tenemos la mejor opción para optimizar tu negocio. KutchenAI es el asistente inteligente que automatiza, vende más y te da el control total. ¡Confía en la plataforma líder y lleva tu restaurante al siguiente nivel!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button size="lg" className="text-lg font-bold px-8 py-6 shadow-lg">
            <Link href="/auth/register">Solicita una demo</Link>
          </Button>
          <Button size="lg" variant="outline" className="text-lg font-bold px-8 py-6">
            <Link href="#funcionalidades">Ver funcionalidades</Link>
          </Button>
        </div>
        <Image
          src="/assets/tablet.png"
          alt="Mesero tomando pedido en tablet"
          width={500}
          height={320}
          className="rounded-xl shadow-xl mb-8"
        />
      </section>

      {/* Confianza */}
      <section className="flex flex-col items-center py-8 px-4">
        <p className="text-lg text-muted-foreground mb-2">Más de <span className="font-bold text-foreground">500 restaurantes</span> confían en KutchenAI</p>
        <div className="flex gap-6 flex-wrap justify-center items-center">
          <Image src="/assets/trust1.svg" alt="Cliente 1" width={80} height={40} />
          <Image src="/assets/trust2.svg" alt="Cliente 2" width={80} height={40} />
          <Image src="/assets/trust3.svg" alt="Cliente 3" width={80} height={40} />
          <Image src="/assets/trust4.svg" alt="Cliente 4" width={80} height={40} />
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-16 px-4 bg-card rounded-t-3xl shadow-inner">
        <h2 className="text-4xl font-bold text-center mb-10 text-foreground">Todo lo que tu restaurante necesita</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <div key={i} className="flex flex-col items-center bg-muted/50 rounded-xl p-6 shadow hover:scale-105 transition-transform">
              <Image src={f.icon} alt={f.title} width={56} height={56} className="mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">{f.title}</h3>
              <p className="text-muted-foreground text-center">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Beneficios */}
      <section className="py-16 px-4 flex flex-col items-center bg-gradient-to-b from-muted/20 to-background">
        <h2 className="text-3xl font-bold mb-6 text-foreground">¿Por qué KutchenAI?</h2>
        <ul className="max-w-3xl text-lg text-muted-foreground space-y-4">
          <li>✅ Ahorra tiempo y dinero automatizando tareas repetitivas.</li>
          <li>✅ Mejora la experiencia de tus clientes con atención 24/7 y pedidos sin errores.</li>
          <li>✅ Toma decisiones inteligentes con reportes y métricas en tiempo real.</li>
          <li>✅ Seguridad y privacidad de nivel bancario.</li>
          <li>✅ Plataforma flexible, escalable y fácil de usar.</li>
        </ul>
      </section>

      {/* CTA final */}
      <section className="py-16 px-4 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-4 text-foreground">¿Listo para transformar tu restaurante?</h2>
        <Button size="lg" className="text-lg font-bold px-8 py-6 shadow-lg mb-2">
          <Link href="/auth/register">Empieza gratis ahora</Link>
        </Button>
        <p className="text-muted-foreground">Sin tarjeta de crédito. Sin compromiso.</p>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-muted-foreground border-t border-border">
        <div className="mb-2">
          <Image src={businessIcon || "/assets/kutchen_app_logo.png"} alt="Logo KutchenAI" width={32} height={32} className="inline-block mr-2" />
          <span className="font-semibold">KutchenAI</span> &copy; {new Date().getFullYear()}
        </div>
        <div>
          Plataforma de gestión inteligente para restaurantes. <Link href="/legal" className="underline">Términos y condiciones</Link>
        </div>
      </footer>
    </div>
  );
}