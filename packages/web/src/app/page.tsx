"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/hooks/use-language";
import React, { useEffect, useState } from "react"
import { API_URL } from '@/lib/api';

const features = [
  { icon: "/assets/dashboard.png" },
  { icon: "/assets/ai.png" },
  { icon: "/assets/pos.png" },
  { icon: "/assets/orders.png" },
  { icon: "/assets/inventory.png" },
  { icon: "/assets/multilocation.png" },
  { icon: "/assets/qr.png" },
];

export default function HomePage() {
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("Kutchen AI")
  const { t, tNested } = useLanguage()

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
              <Link href="/auth/login">{t('login')}</Link>
            </Button>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center px-4 py-12 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {t('heroTitle')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/auth/register">{t('requestDemo')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                <Link href="#features">{t('viewFeatures')}</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-12 md:py-24 bg-muted/30">
          <div className="max-w-4xl mx-auto text-center px-4">
            <p className="text-2xl md:text-3xl font-semibold">
              {t('trustText')} <span className="text-primary font-bold">{t('restaurants')}</span> {t('trustIn')}
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-12 md:py-24">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              {t('featuresTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => {
                const featuresData = tNested('features');
                const featureData = featuresData[index];
                return (
                  <div key={index} className="bg-card rounded-lg p-6 border shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                      <Image
                        src={feature.icon}
                        alt={featureData?.title || `Feature ${index + 1}`}
                        width={48}
                        height={48}
                        className="rounded-lg"
                      />
                      <h3 className="text-xl font-semibold">{featureData?.title}</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {featureData?.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 md:py-24 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              {t('whyTitle')}
            </h2>
            <div className="space-y-6">
              {tNested('benefits').map((benefit, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-primary-foreground text-sm font-bold">{index + 1}</span>
                  </div>
                  <p className="text-lg leading-relaxed">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-24">
          <div className="max-w-4xl mx-auto text-center px-4 space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              {t('readyTitle')}
            </h2>
            <div className="space-y-4">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/auth/register">{t('startFree')}</Link>
              </Button>
              <p className="text-muted-foreground">
                {t('noCreditCard')}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-muted-foreground mb-4">
              {t('platformDescription')}
            </p>
            <div className="flex justify-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                {t('termsAndConditions')}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}