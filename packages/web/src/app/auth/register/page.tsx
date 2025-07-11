'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useToast } from '@/components/ui/use-toast';
import { AvatarUpload } from '@/components/avatar-upload';
import Image from 'next/image';
import { ThemeSwitch } from '@/components/theme-switch';
import { LanguageSwitch } from '@/components/language-switch';
import { useLanguage } from '@/hooks/use-language';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenantName: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    avatar: '',
  });
  const { t } = useLanguage();
  const [businessIcon, setBusinessIcon] = useState<string>("/assets/kutchen_app_logo.png");
  const [businessName, setBusinessName] = useState<string>("Kutchen AI");

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await fetch('/api/settings/business');
        if (res.ok) {
          const data = await res.json();
          setBusinessIcon(data.logo || "/assets/kutchen_app_logo.png");
          setBusinessName(data.name || "Kutchen AI");
        }
      } catch {}
    };
    fetchBusiness();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          role: 'CUSTOMER', // Default role for registration
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Registration failed';
        if (response.status === 409) {
          errorMsg = 'El correo electrónico ya está registrado para este negocio.';
        } else {
          try {
            const error = await response.json();
            if (Array.isArray(error.message)) {
              errorMsg = error.message.join('\n');
            } else if (typeof error.message === 'string') {
              errorMsg = error.message;
            } else {
              errorMsg = error.error || errorMsg;
            }
          } catch {}
        }
        throw new Error(errorMsg);
      }

      toast({
        title: 'Success',
        description: 'Your account has been created.',
      });

      router.push('/auth/login');
    } catch (error) {
      let errorMsg = 'An error occurred';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      toast({
        title: 'Error',
        description: (
          <span style={{ whiteSpace: 'pre-line' }}>{errorMsg}</span>
        ),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getInitials = () => {
    return `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="relative min-h-screen w-screen flex flex-col items-center justify-center bg-background">
      {/* Barra superior con selectores y logo */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-between px-2 py-2 md:px-8 md:py-4 z-10">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image
              src={businessIcon}
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
      {/* Contenido principal */}
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">{t('registerTitle')}</CardTitle>
            <CardDescription className="text-center">
              {t('registerDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tenantName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('registerBusinessPlaceholder')}
              </label>
              <Input
                id="tenantName"
                placeholder={t('registerBusinessExample')}
                value={formData.tenantName}
                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t('registerFirstName')}
                </label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t('registerLastName')}
                </label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('registerEmail')}
              </label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('registerPassword')}
              </label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Avatar
              </label>
              <AvatarUpload
                onImageUploaded={(url) => setFormData({ ...formData, avatar: url })}
                currentImage={formData.avatar}
                initials={`${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase()}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={isLoading} onClick={handleSubmit}>
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('registerButton')}
            </Button>
          </CardFooter>
          <div className="px-6 pb-6">
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
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button variant="outline" disabled={isLoading}>
                {isLoading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.google className="mr-2 h-4 w-4" />
                )}
                {t('loginGoogle')}
              </Button>
              <Button variant="outline" disabled={isLoading}>
                {isLoading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.facebook className="mr-2 h-4 w-4" />
                )}
                {t('loginFacebook')}
              </Button>
            </div>
            <div className="mt-6 text-center text-sm">
              {t('registerAlreadyHave')}{" "}
              <Link href="/auth/login" className="underline underline-offset-4 hover:text-primary">
                {t('registerSignIn')}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}