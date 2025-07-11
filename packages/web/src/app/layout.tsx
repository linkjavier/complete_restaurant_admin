import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'KutchenAI - La IA que Revoluciona la Gestión de Restaurantes',
    template: '%s | KutchenAI'
  },
  description: 'KutchenAI es la plataforma líder de gestión inteligente para restaurantes, panaderías, cafeterías y negocios de servicio a la mesa. Automatiza pedidos, controla inventario, gestiona personal y aumenta ventas con IA avanzada. ¡Únete a más de 500 restaurantes que ya confían en nosotros!',
  keywords: [
    'gestión restaurantes',
    'IA restaurantes',
    'sistema restaurante',
    'POS restaurante',
    'inventario restaurante',
    'pedidos online',
    'gestión cafetería',
    'panadería digital',
    'servicio mesa',
    'automatización restaurante',
    'inteligencia artificial restaurantes',
    'software restaurante',
    'app restaurante',
    'gestión negocio',
    'ventas restaurante',
    'control cocina',
    'CRM restaurante',
    'multi-sucursal',
    'reportes restaurante',
    'optimización restaurante'
  ],
  authors: [{ name: 'KutchenAI Team' }],
  creator: 'KutchenAI',
  publisher: 'KutchenAI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://kutchenai.com'),
  alternates: {
    canonical: '/',
    languages: {
      'es': '/es',
      'en': '/en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://kutchenai.com',
    siteName: 'KutchenAI',
    title: 'KutchenAI - La IA que Revoluciona la Gestión de Restaurantes',
    description: 'La plataforma líder de gestión inteligente para restaurantes, panaderías y cafeterías. Automatiza pedidos, controla inventario y aumenta ventas con IA avanzada.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'KutchenAI - Gestión Inteligente de Restaurantes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@kutchenai',
    creator: '@kutchenai',
    title: 'KutchenAI - La IA que Revoluciona la Gestión de Restaurantes',
    description: 'La plataforma líder de gestión inteligente para restaurantes, panaderías y cafeterías. Automatiza pedidos, controla inventario y aumenta ventas con IA avanzada.',
    images: ['/twitter-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  category: 'technology',
  classification: 'Restaurant Management Software',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'KutchenAI',
    'application-name': 'KutchenAI',
    'msapplication-TileColor': '#000000',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#000000',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="theme-color" content="#000000" />
        
        {/* Structured Data for Restaurant Management Software */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "KutchenAI",
              "description": "Plataforma de gestión inteligente para restaurantes con IA avanzada",
              "url": "https://kutchenai.com",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web, iOS, Android",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "description": "Plan gratuito disponible"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "500"
              },
              "provider": {
                "@type": "Organization",
                "name": "KutchenAI",
                "url": "https://kutchenai.com"
              }
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <AuthProvider>
              <div className="min-h-screen bg-background">
                {children}
              </div>
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
} 