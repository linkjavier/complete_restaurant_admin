'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { ThemeSwitch } from "@/components/theme-switch"
import Head from 'next/head';
import { API_URL } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/hooks/use-language';
import { LanguageSwitch } from '@/components/language-switch';

// Custom hook for mobile viewport height
function useMobileViewportHeight() {
  const [vh, setVh] = useState('100vh');

  useEffect(() => {
    const updateHeight = () => {
      // Get the viewport height and multiply it by 1% to get a value for a vh unit
      const vh = window.innerHeight * 0.01;
      // Set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setVh(`${window.innerHeight}px`);
    };

    // Initial update
    updateHeight();

    // Add event listeners
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('scroll', updateHeight);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('scroll', updateHeight);
    };
  }, []);

  return vh;
}

function getSubdomain(hostname: string) {
  const parts = hostname.split('.');
  // localhost o IP: subdominio.localhost o subdominio.127.0.0.1
  if (
    (hostname.endsWith('localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) &&
    parts.length >= 2
  ) {
    // Si es localhost y tiene dos partes, el primero es el subdominio
    if (parts.length === 2) return parts[0];
    // Si es IP y tiene más de 2 partes, el primero es el subdominio
    if (parts.length > 2) return parts[0];
  }
  // Producción: subdominio.tudominio.com
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const vh = useMobileViewportHeight();
  const [businessIcon, setBusinessIcon] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("Kutchen AI");
  const [showSubdomainModal, setShowSubdomainModal] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState('');
  const { t } = useLanguage();
  const [subdomainChecked, setSubdomainChecked] = useState(false);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await fetch(`${API_URL}/settings/business`);
        if (res.ok) {
          const data = await res.json();
          setBusinessIcon(data.logo || "");
          setBusinessName(data.name || "Kutchen AI");
        }
      } catch {}
    };
    fetchBusiness();

    // Detectar subdominio solo en el primer render
    if (typeof window !== 'undefined') {
      const subdomain = getSubdomain(window.location.hostname);
      // Solo mostrar el modal si NO hay subdominio o es www
      if (!subdomain || subdomain === 'www') {
        setShowSubdomainModal(true);
      } else {
        setShowSubdomainModal(false);
      }
      setSubdomainChecked(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('[LoginPage] Starting login process...');
      const data = await login(email, password);
      
      console.log('[LoginPage] Login successful, user data:', data);
      
      toast({
        title: 'Success',
        description: 'You have been logged in successfully.',
      });

      // Guardar el token en localStorage
      localStorage.setItem('token', data.access_token);
      // Guardar el token como cookie accesible por el middleware y subdominios
      document.cookie = `token=${data.access_token}; path=/; max-age=604800; domain=.localhost`;
      // Redirigir al dashboard de forma fluida
      router.push('/admin/dashboard');
    } catch (error) {
      console.error('[LoginPage] Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setIsLoading(true);
    try {
      // Redirect to social login endpoint
      window.location.href = `/api/auth/${provider}`;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initiate social login',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleSubdomainNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdomainInput) return;
    const { protocol, hostname, port } = window.location;
    const domainParts = hostname.split('.');
    let baseDomain = hostname;
    // Si es localhost o IP, mantener el comportamiento local
    if (
      hostname.endsWith('localhost') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      baseDomain = hostname.replace(/^[^.]+\./, ''); // quita el subdominio si existe
    } else {
      // Para prod: quita el subdominio si existe (ej: sub.tudominio.com -> tudominio.com)
      baseDomain = domainParts.slice(-2).join('.');
    }
    const portPart = port ? `:${port}` : '';
    const url = `${protocol}//${subdomainInput}.${baseDomain}${portPart}/auth/login`;
    window.location.href = url;
  };

  if (!subdomainChecked) return null;

  if (showSubdomainModal) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-background">
        {/* Modal de subdominio */}
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm transition-all duration-500">
          <form
            onSubmit={handleSubdomainNext}
            className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto animate-fade-in"
          >
            <Image
              src={businessIcon || "/assets/kutchen_app_logo.png"}
              alt="Logo KutchenAI"
              width={96}
              height={96}
              className="mb-2"
              priority
            />
            <h2 className="text-2xl font-bold text-center">{t('loginSubdomainTitle')}</h2>
            <Input
              autoFocus
              placeholder={t('loginSubdomainPlaceholder')}
              value={subdomainInput}
              onChange={e => setSubdomainInput(e.target.value)}
              className="text-center text-lg"
              required
            />
            <Button type="submit" size="lg" className="w-full text-lg font-bold">{t('loginSubdomainButton')}</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div 
        className="min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] w-full overflow-x-hidden"
        style={{ minHeight: vh }}
      >
        <div className="absolute top-0 left-0 w-full flex items-center justify-between px-2 py-2 md:px-8 md:py-4 z-10">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Image
                src={businessIcon || "/assets/kutchen_app_logo.png"}
                alt="Logo KutchenAI"
                width={56}
                height={56}
                priority
                className="cursor-pointer"
              />
            </Link>
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
        <div className="container relative flex w-full min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] flex-col items-center justify-center px-4">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="space-y-1">
              <div className="flex justify-center mb-6">
                <Image
                  src={businessIcon || "/assets/kutchen_app_logo.png"}
                  alt="Logo Negocio"
                  width={120}
                  height={120}
                  priority
                />
              </div>
              <CardTitle className="text-2xl">{businessName}</CardTitle>
              <CardDescription>
                {t('loginDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-6">
                <Button 
                  variant="outline" 
                  disabled={isLoading}
                  onClick={() => handleSocialLogin('google')}
                >
                  {isLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.google className="mr-2 h-4 w-4" />
                  )}
                  {t('loginGoogle')}
                </Button>
                <Button 
                  variant="outline" 
                  disabled={isLoading}
                  onClick={() => handleSocialLogin('facebook')}
                >
                  {isLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.facebook className="mr-2 h-4 w-4" />
                  )}
                  {t('loginFacebook')}
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('loginOrContinue')}
                  </span>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="grid gap-2">
                <Input
                  id="email"
                  placeholder={t('loginEmail')}
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  id="password"
                  placeholder={t('loginPassword')}
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button disabled={isLoading}>
                  {isLoading && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t('loginButton')}
                </Button>
              </form>
            </CardContent>
            <CardFooter>
              <p className="text-center text-sm text-muted-foreground">
                {t('loginNoAccount')}{' '}
                <Link
                  href="/auth/register"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {t('loginSignUp')}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}

// Animación fade-in para el modal
// Agrega esto a tu CSS global o tailwind.config.js:
// .animate-fade-in { @apply opacity-0 scale-95; animation: fadeIn 0.4s forwards; }
// @keyframes fadeIn { to { opacity: 1; scale: 1; } }