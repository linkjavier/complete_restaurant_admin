"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/hooks/use-language";
import { translations } from "@/lib/translations";
import { landingTranslations } from "@/lib/landing-translations";
import React, { useEffect, useState } from "react"
import { API_URL } from '@/lib/api';
import { Check, Star, ArrowRight, Zap, TrendingUp, Users, Clock, Shield } from 'lucide-react';

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
  const { language, changeLanguage } = useLanguage()
  const t = translations[language as keyof typeof translations] || translations.es
  const lt = landingTranslations[language as keyof typeof landingTranslations] || landingTranslations.es

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
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                <Zap className="w-4 h-4 mr-2" />
                {lt.platformNumberOne}
              </span>
            </div>
            <h1 id="hero-title" className="text-5xl md:text-7xl font-extrabold text-foreground max-w-4xl mb-6 leading-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mb-8 leading-relaxed">
              {t.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button size="lg" className="text-lg font-bold px-8 py-6 shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                <Link href="/auth/register" className="flex items-center">
                  {t.requestDemo}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg font-bold px-8 py-6 border-2">
                <Link href="#segmentos">{t.viewFeatures}</Link>
              </Button>
            </div>
            <div className="relative">
            <Image
              src="/assets/tablet.png"
              alt="Mesero utilizando tablet para tomar pedidos con KutchenAI"
                width={600}
                height={400}
                className="rounded-xl shadow-2xl mb-8"
              priority
            />
              <div className="absolute -top-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
                {lt.activeRestaurants}
              </div>
            </div>
          </section>

          {/* Trust Section */}
          <section className="flex flex-col items-center py-8 px-4" aria-labelledby="trust-title">
            <p id="trust-title" className="text-lg text-muted-foreground mb-2">
              {t.trustText} <span className="font-bold text-foreground">{t.restaurants}</span> {t.trustIn}
            </p>
          </section>

          {/* Market Segments Section */}
          <section id="segmentos" className="py-20 px-4 bg-gradient-to-b from-card to-background" aria-labelledby="segments-title">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 id="segments-title" className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  {lt.marketSegmentsTitle}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  {lt.marketSegmentsSubtitle}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {lt.marketSegments.map((segment, index) => (
                  <div
                    key={index}
                    className="group relative bg-card border border-border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
                  >
                    <div className="text-4xl mb-4">{segment.icon}</div>
                    <h3 className="text-xl font-bold mb-2 text-foreground">{segment.title}</h3>
                    <p className="text-sm font-medium text-primary mb-3">{segment.subtitle}</p>
                    <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                      {segment.description}
                    </p>
                    <ul className="space-y-2">
                      {segment.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-sm text-muted-foreground">
                          <Check className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="funcionalidades" className="py-20 px-4 bg-background" aria-labelledby="features-title">
            <div className="max-w-6xl mx-auto">
              <h2 id="features-title" className="text-4xl md:text-5xl font-bold text-center mb-16 text-foreground">
                {t.featuresTitle}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {t.features.map((f, i) => {
                const imageSrc = features[i].icon;
                let imgWidth = 500;
                let imgHeight = 320;
                return (
                  <article
                    key={i}
                      className="relative flex items-end justify-start h-80 w-full rounded-2xl shadow-lg overflow-hidden group bg-black hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                  >
                    <Image
                      src={imageSrc}
                      alt={f.title}
                      width={imgWidth}
                      height={imgHeight}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      priority={i === 2 || i === 4}
                    />
                    <div
                        className="absolute bottom-0 left-0 w-full p-6"
                      style={{
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.9) 100%)',
                      }}
                    >
                        <h3 className="text-xl font-bold mb-2 text-white">{f.title}</h3>
                        <p className="text-sm text-white/90 leading-relaxed">{f.desc}</p>
                    </div>
                  </article>
                );
              })}
              </div>
            </div>
          </section>

          {/* Advanced Features Section */}
          <section className="py-20 px-4 bg-gradient-to-b from-muted/20 to-background" aria-labelledby="advanced-features-title">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 id="advanced-features-title" className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  {lt.advancedFeaturesTitle}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  {lt.advancedFeaturesSubtitle}
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {lt.advancedFeatures.map((feature, index) => (
                  <div key={index} className="bg-card border border-border rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-3 text-foreground">{feature.title}</h3>
                        <p className="text-muted-foreground mb-6 leading-relaxed">{feature.description}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {feature.benefits.map((benefit, idx) => (
                            <div key={idx} className="flex items-center text-sm">
                              <Check className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                              {benefit}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Success Stories Section */}
          <section className="py-20 px-4 bg-card" aria-labelledby="success-stories-title">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 id="success-stories-title" className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  {lt.successStoriesTitle}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  {lt.successStoriesSubtitle}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {lt.successStories.map((story, index) => (
                  <div key={index} className="bg-background border border-border rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{story.name}</h4>
                        <p className="text-sm text-primary">{story.type}</p>
                        <p className="text-xs text-muted-foreground">{story.location}</p>
                      </div>
                    </div>
                    <blockquote className="text-muted-foreground mb-6 italic leading-relaxed">
                      "{story.testimonial}"
                    </blockquote>
                    <div className="space-y-2">
                      {story.metrics.map((metric, idx) => (
                        <div key={idx} className="flex items-center text-sm">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          {metric}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ROI Section */}
          <section className="py-20 px-4 bg-gradient-to-r from-primary/5 to-primary/10" aria-labelledby="roi-title">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 id="roi-title" className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  {lt.roiTitle}
                </h2>
                <p className="text-xl text-muted-foreground">
                  {lt.roiSubtitle}
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {lt.roiMetrics.map((metric, index) => (
                  <div key={index} className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                      {metric.metric}
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {metric.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section className="py-20 px-4 bg-background" aria-labelledby="pricing-title">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 id="pricing-title" className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  {lt.pricingTitle}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  {lt.pricingSubtitle}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {lt.pricingPlans.map((plan, index) => (
                  <div
                    key={index}
                    className={`relative bg-card border rounded-2xl p-8 ${
                      plan.popular 
                        ? 'border-primary shadow-xl scale-105' 
                        : 'border-border hover:shadow-lg'
                    } transition-all duration-300`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold">
                          {lt.mostPopular}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold mb-2 text-foreground">{plan.name}</h3>
                      <div className="mb-2">
                        <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground">{plan.period}</span>
                      </div>
                      <p className="text-muted-foreground">{plan.description}</p>
                    </div>
                    
                    <ul className="space-y-4 mb-8 max-h-96 overflow-y-auto">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <Check className="w-5 h-5 mr-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground text-sm leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      className={`w-full py-3 ${
                        plan.popular 
                          ? 'bg-primary hover:bg-primary/90' 
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                      onClick={async () => {
                        // Guardar el plan seleccionado
                        localStorage.setItem('selectedPlan', plan.name);
                        // Llamar al backend para crear la sesión de Stripe Checkout
                        try {
                          // En desarrollo, usar el endpoint de prueba
                          const endpoint = process.env.NODE_ENV === 'development' 
                            ? `${API_URL}/payments/test/checkout`
                            : `${API_URL}/payments/stripe/checkout`;
                          
                          const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ plan: plan.name }),
                          });
                          const data = await res.json();
                          if (data.url) {
                            window.location.href = data.url;
                          } else {
                            alert('Error iniciando el pago.');
                          }
                        } catch (err) {
                          alert('Error de conexión.');
                        }
                      }}
                    >
                      {plan.cta} <span className="ml-2">💳</span>
                    </Button>
                  </div>
                ))}
              </div>
              
              {/* PTD Information */}
              <div className="mt-12 text-center">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 max-w-2xl mx-auto">
                  <p className="text-lg font-semibold text-primary mb-2">💡 ¿Necesitas más flexibilidad?</p>
                  <p className="text-muted-foreground">{lt.ptdInfo}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="py-20 px-4 bg-gradient-to-b from-muted/20 to-background" aria-labelledby="benefits-title">
            <div className="max-w-4xl mx-auto">
              <h2 id="benefits-title" className="text-4xl font-bold mb-12 text-center text-foreground">
                {t.whyTitle}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {t.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center mt-1">
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-lg text-muted-foreground leading-relaxed">{benefit}</p>
                  </div>
              ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-20 px-4 bg-gradient-to-r from-primary to-primary/80" aria-labelledby="cta-title">
            <div className="max-w-4xl mx-auto text-center">
              <h2 id="cta-title" className="text-4xl md:text-5xl font-bold mb-6 text-primary-foreground">
                {t.readyTitle}
              </h2>
              <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                {lt.joinRestaurants}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg font-bold px-8 py-6 bg-background text-foreground hover:bg-background/90">
              <Link href="/auth/register">{t.startFree}</Link>
            </Button>
                <Button size="lg" variant="outline" className="text-lg font-bold px-8 py-6 border-2 border-white text-white hover:bg-white hover:text-primary">
                  <Link href="https://wa.me/573003943675" target="_blank">
                    {lt.talkToExpert}
                  </Link>
                </Button>
              </div>
              <p className="text-primary-foreground/80 mt-4">{t.noCreditCard}</p>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="py-12 px-4 text-center text-muted-foreground border-t border-border bg-card" role="contentinfo">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
            <Image 
              src={businessIcon || "/assets/kutchen_app_logo.png"} 
              alt="KutchenAI logo" 
                width={48} 
                height={48} 
                className="inline-block mr-3" 
            />
              <span className="text-2xl font-bold text-foreground">KutchenAI</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-left">
              <div>
                <h4 className="font-semibold text-foreground mb-4">{lt.product}</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#funcionalidades" className="hover:text-foreground transition-colors">{lt.featuresLink}</a></li>
                  <li><a href="#segmentos" className="hover:text-foreground transition-colors">{lt.segments}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.pricing}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.integrations}</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">{lt.company}</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.aboutUs}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.blog}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.careers}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.press}</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">{lt.support}</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.helpCenter}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.documentation}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.community}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.serviceStatus}</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">{lt.legal}</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.privacy}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.terms}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.cookies}</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">{lt.security}</a></li>
                </ul>
              </div>
          </div>
            
            <div className="border-t border-border pt-8">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                  <a href="mailto:kutchenai@gmail.com" className="hover:text-foreground transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
                kutchenai@gmail.com
              </a>
                  <a href="https://wa.me/573003943675" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A11.87 11.87 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.22-1.63A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.19-1.24-6.19-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.22-1.44l-.37-.22-3.69.97.99-3.59-.24-.37A9.94 9.94 0 0 1 2 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.2-7.8c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.34-.26.27-1 1-.99 2.43.01 1.43 1.03 2.81 1.18 3 .15.19 2.03 3.1 4.93 4.22.69.3 1.23.48 1.65.62.69.22 1.32.19 1.81.12.55-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z"/></svg>
                +57 300 394 3675
              </a>
            </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{lt.location}</span>
                  <a href="https://www.instagram.com/kutchenai/" target="_blank" rel="noopener noreferrer" aria-label="Instagram KutchenAI" className="hover:text-foreground transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
            </div>
          </div>
              <div className="text-sm">
                <p>{lt.platformDescription} <Link href="/legal" className="underline hover:text-foreground">{lt.termsAndConditions}</Link></p>
                <p className="mt-2">&copy; {new Date().getFullYear()} KutchenAI. {lt.allRightsReserved}</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}