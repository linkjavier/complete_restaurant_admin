"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/hooks/use-language";
import { translations } from "@/lib/translations";
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
  const { language, changeLanguage } = useLanguage()
  const t = translations[language as keyof typeof translations] || translations.es

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
    <>
      {/* Schema.org structured data for better SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "KutchenAI",
            "description": "La plataforma líder de gestión inteligente para restaurantes con IA",
            "url": "https://kutchenai.com",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://kutchenai.com/search?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          })
        }}
      />
      
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20 dark:from-background dark:to-muted/10">
        {/* Header */}
        <header className="flex items-center justify-between px-2 py-2 md:px-8 md:py-6" role="banner">
          <div className="flex items-center gap-1 md:gap-3">
            <Image 
              src={businessIcon || "/assets/kutchen_app_logo.png"} 
              alt="KutchenAI - Logo de la plataforma de gestión de restaurantes" 
              width={72} 
              height={72}
              priority
            />
            <span className="text-2xl font-bold text-foreground hidden md:block">KutchenAI</span>
          </div>
          <nav className="flex items-center gap-1 md:gap-4" role="navigation" aria-label="Navegación principal">
            <LanguageSwitch 
              currentLanguage={language} 
              onLanguageChange={changeLanguage} 
            />
            <ThemeSwitch />
            <Button asChild variant="outline" className="font-semibold">
              <Link href="/auth/login">{t.login}</Link>
            </Button>
          </nav>
        </header>

        {/* Hero Section */}
        <main role="main">
          <section className="flex flex-col items-center justify-center text-center pt-4 md:pt-16 pb-8 md:pb-16 px-4" aria-labelledby="hero-title">
            <h1 id="hero-title" className="text-5xl md:text-6xl font-extrabold text-foreground max-w-3xl mb-6 leading-tight">
              {t.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-8">
              {t.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button size="lg" className="text-lg font-bold px-8 py-6 shadow-lg">
                <Link href="/auth/register">{t.requestDemo}</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg font-bold px-8 py-6">
                <Link href="#funcionalidades">{t.viewFeatures}</Link>
              </Button>
            </div>
            <Image
              src="/assets/tablet.png"
              alt="Mesero utilizando tablet para tomar pedidos con KutchenAI"
              width={500}
              height={320}
              className="rounded-xl shadow-xl mb-8"
              priority
            />
          </section>

          {/* Trust Section */}
          <section className="flex flex-col items-center py-8 px-4" aria-labelledby="trust-title">
            <p id="trust-title" className="text-lg text-muted-foreground mb-2">
              {t.trustText} <span className="font-bold text-foreground">{t.restaurants}</span> {t.trustIn}
            </p>
            <div className="flex gap-6 flex-wrap justify-center items-center" role="img" aria-label="Logos de restaurantes que confían en KutchenAI">
              <Image src="/assets/trust1.svg" alt="Restaurante cliente 1" width={80} height={40} className="dark:invert" />
              <Image src="/assets/trust2.svg" alt="Restaurante cliente 2" width={80} height={40} className="dark:invert" />
              <Image src="/assets/trust3.svg" alt="Restaurante cliente 3" width={80} height={40} className="dark:invert" />
              <Image src="/assets/trust4.svg" alt="Restaurante cliente 4" width={80} height={40} className="dark:invert" />
            </div>
          </section>

          {/* Features Section */}
          <section id="funcionalidades" className="py-16 px-4 bg-card rounded-t-3xl shadow-inner" aria-labelledby="features-title">
            <h2 id="features-title" className="text-4xl font-bold text-center mb-10 text-foreground">{t.featuresTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {t.features.map((f, i) => (
                <article key={i} className="flex flex-col items-center bg-muted/50 rounded-xl p-6 shadow hover:scale-105 transition-transform">
                  <Image 
                    src={f.icon} 
                    alt={`Icono de ${f.title}`} 
                    width={56} 
                    height={56} 
                    className="mb-4 dark:invert" 
                  />
                  <h3 className="text-xl font-semibold mb-2 text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground text-center">{f.desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Benefits Section */}
          <section className="py-16 px-4 flex flex-col items-center bg-gradient-to-b from-muted/20 to-background" aria-labelledby="benefits-title">
            <h2 id="benefits-title" className="text-3xl font-bold mb-6 text-foreground">{t.whyTitle}</h2>
            <ul className="max-w-3xl text-lg text-muted-foreground space-y-4">
              {t.benefits.map((benefit, index) => (
                <li key={index}>✅ {benefit}</li>
              ))}
            </ul>
          </section>

          {/* CTA final */}
          <section className="py-16 px-4 flex flex-col items-center" aria-labelledby="cta-title">
            <h2 id="cta-title" className="text-3xl font-bold mb-4 text-foreground">{t.readyTitle}</h2>
            <Button size="lg" className="text-lg font-bold px-8 py-6 shadow-lg mb-2">
              <Link href="/auth/register">{t.startFree}</Link>
            </Button>
            <p className="text-muted-foreground">{t.noCreditCard}</p>
          </section>
        </main>

        {/* Footer */}
        <footer className="py-8 px-4 text-center text-muted-foreground border-t border-border" role="contentinfo">
          <div className="mb-2">
            <Image 
              src={businessIcon || "/assets/kutchen_app_logo.png"} 
              alt="KutchenAI logo" 
              width={32} 
              height={32} 
              className="inline-block mr-2" 
            />
            <span className="font-semibold">KutchenAI</span> &copy; {new Date().getFullYear()}
          </div>
          <div>
            {t.platformDescription} <Link href="/legal" className="underline">{t.termsAndConditions}</Link>
          </div>
        </footer>
      </div>
    </>
  );
}