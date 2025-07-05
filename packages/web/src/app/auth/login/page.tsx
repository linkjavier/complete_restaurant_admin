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
import { Dialog } from '@/components/ui/dialog';
import { useLanguage } from '@/hooks/use-language';
import { translations } from '@/lib/translations';

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
  // Ejemplo: negociojavier.localhost o negociojavier.127.0.0.1
  const parts = hostname.split('.');
  if (
    (hostname.endsWith('localhost') || hostname.match(/\d+\.\d+\.\d+\.\d+/)) &&
    parts.length > 2
  ) {
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
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.es;

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

    // Detectar subdominio
    if (typeof window !== 'undefined') {
      const subdomain = getSubdomain(window.location.hostname);
      if (!subdomain) {
        setShowSubdomainModal(true);
      }
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
    // Redirigir a subdominio.localhost:3001/auth/login
    const port = window.location.port ? `:${window.location.port}` : '';
    window.location.href = `http://${subdomainInput}.localhost${port}/auth/login`;
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div 
        className="min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] w-full overflow-x-hidden"
        style={{ minHeight: vh }}
      >
        <div className="container relative flex w-full min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] flex-col items-center justify-center px-4">
          <div className="fixed top-4 right-4 z-50">
            <ThemeSwitch />
          </div>
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
                Enter your email to sign in to your account
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
                  Google
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
                  Facebook
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="grid gap-2">
                <Input
                  id="email"
                  placeholder="name@example.com"
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
                  placeholder="Password"
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
                  Sign In
                </Button>
              </form>
            </CardContent>
            <CardFooter>
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  href="/auth/register"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Modal de subdominio */}
      {showSubdomainModal && (
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
            <h2 className="text-2xl font-bold text-center">{t.loginSubdomainTitle}</h2>
            <Input
              autoFocus
              placeholder={t.loginSubdomainPlaceholder}
              value={subdomainInput}
              onChange={e => setSubdomainInput(e.target.value)}
              className="text-center text-lg"
              required
            />
            <Button type="submit" size="lg" className="w-full text-lg font-bold">{t.loginSubdomainButton}</Button>
          </form>
        </div>
      )}
    </>
  );
}

// Animación fade-in para el modal
// Agrega esto a tu CSS global o tailwind.config.js:
// .animate-fade-in { @apply opacity-0 scale-95; animation: fadeIn 0.4s forwards; }
// @keyframes fadeIn { to { opacity: 1; scale: 1; } }