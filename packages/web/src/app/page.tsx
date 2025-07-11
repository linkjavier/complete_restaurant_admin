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
  { icon: "/assets/dashboard.png" },
  { icon: "/assets/ai.png" },
  { icon: "/assets/pos.png" },
  { icon: "/assets/orders.png" },
  { icon: "/assets/inventory.png" },
  { icon: "/assets/multilocation.png" },
  // { icon: "/assets/customers.svg" },
  // { icon: "/assets/settings.svg" },
  { icon: "/assets/qr.png" },
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
            <LanguageSwitch />
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
            {/* <div className="flex gap-6 flex-wrap justify-center items-center" role="img" aria-label="Logos de restaurantes que confían en KutchenAI">
              <Image src="/assets/trust1.svg" alt="Restaurante cliente 1" width={80} height={40} className="dark:invert" />
              <Image src="/assets/trust2.svg" alt="Restaurante cliente 2" width={80} height={40} className="dark:invert" />
              <Image src="/assets/trust3.svg" alt="Restaurante cliente 3" width={80} height={40} className="dark:invert" />
              <Image src="/assets/trust4.svg" alt="Restaurante cliente 4" width={80} height={40} className="dark:invert" />
            </div> */}
          </section>

          {/* Features Section */}
          <section id="funcionalidades" className="py-16 px-4 bg-card rounded-t-3xl shadow-inner" aria-labelledby="features-title">
            <h2 id="features-title" className="text-4xl font-bold text-center mb-10 text-foreground">{t.featuresTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {t.features.map((f, i) => {
                const imageSrc = features[i].icon;
                let imgWidth = 500;
                let imgHeight = 320;
                return (
                  <article
                    key={i}
                    className="relative flex items-end justify-start h-72 w-full rounded-xl shadow overflow-hidden group bg-black"
                    style={{ minHeight: 280 }}
                  >
                    <Image
                      src={imageSrc}
                      alt={f.title}
                      width={imgWidth}
                      height={imgHeight}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectFit: 'cover', zIndex: 0 }}
                      priority={i === 2 || i === 4}
                    />
                    <div
                      className="absolute bottom-0 left-0 w-full p-4"
                      style={{
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.85) 100%)',
                        boxShadow: '0 8px 32px 0 rgba(0,0,0,0.7)'
                      }}
                    >
                      <h3 className="text-xl font-bold mb-1 text-white drop-shadow-lg">{f.title}</h3>
                      <p className="text-sm text-white drop-shadow-lg">{f.desc}</p>
                    </div>
                  </article>
                );
              })}
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
            <h2 id="cta-title" className="text-3xl font-bold mb-4 text-foreground text-center">{t.readyTitle}</h2>
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
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="flex flex-col sm:flex-row items-center gap-2 text-base">
              <a href="mailto:kutchenai@gmail.com" className="hover:underline flex items-center gap-1" aria-label="Correo electrónico">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
                kutchenai@gmail.com
              </a>
              <span className="hidden sm:inline">|</span>
              <a href="https://wa.me/573003943675" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" aria-label="WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A11.87 11.87 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.22-1.63A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.19-1.24-6.19-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.22-1.44l-.37-.22-3.69.97.99-3.59-.24-.37A9.94 9.94 0 0 1 2 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.2-7.8c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.34-.26.27-1 1-.99 2.43.01 1.43 1.03 2.81 1.18 3 .15.19 2.03 3.1 4.93 4.22.69.3 1.23.48 1.65.62.69.22 1.32.19 1.81.12.55-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z"/></svg>
                +57 300 394 3675
              </a>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-13a6 6 0 0 0-6 6c0 3.31 2.69 6 6 6s6-2.69 6-6a6 6 0 0 0-6-6zm0 11a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
                Cali - Colombia
              </span>
            </div>
            <div className="flex justify-center mt-2">
              <a href="https://www.instagram.com/kutchenai/" target="_blank" rel="noopener noreferrer" aria-label="Instagram KutchenAI" className="hover:opacity-80 flex items-center justify-center" style={{width:'32px',height:'32px'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
                  <rect x="4" y="4" width="24" height="24" rx="6"/>
                  <circle cx="16" cy="16" r="7"/>
                  <circle cx="23" cy="9" r="1.5"/>
                </svg>
              </a>
            </div>
          </div>
          <div>
            {t.platformDescription} <Link href="/legal" className="underline">{t.termsAndConditions}</Link>
          </div>
        </footer>
      </div>
    </>
  );
}