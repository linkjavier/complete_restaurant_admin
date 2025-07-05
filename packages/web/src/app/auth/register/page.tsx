'use client';

import { useState } from 'react';
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
import { translations } from '@/lib/translations';

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
  const { language, changeLanguage } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.es;

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
          <Image
            src={"/assets/kutchen_app_logo.png"}
            alt="Logo KutchenAI"
            width={56}
            height={56}
            priority
          />
        </div>
        <div className="flex items-center gap-1 md:gap-4">
          <LanguageSwitch currentLanguage={language} onLanguageChange={changeLanguage} />
          <ThemeSwitch />
        </div>
      </div>
      {/* Contenido principal */}
      <div className="flex flex-1 items-center justify-center w-full">
        <Card className="w-full max-w-md mt-20 md:mt-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">{t.registerTitle}</CardTitle>
            <CardDescription>
              {t.registerDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Input
                id="tenantName"
                name="tenantName"
                placeholder={t.registerBusinessPlaceholder}
                type="text"
                autoCapitalize="words"
                autoComplete="organization"
                autoCorrect="off"
                disabled={isLoading}
                value={formData.tenantName}
                onChange={handleChange}
              />
              <span className="text-xs text-muted-foreground mb-2">{t.registerBusinessExample}</span>
              <AvatarUpload
                onImageUploaded={(url) => setFormData(prev => ({ ...prev, avatar: url }))}
                currentImage={formData.avatar}
                initials={getInitials()}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder={t.registerFirstName}
                  type="text"
                  autoCapitalize="none"
                  autoComplete="given-name"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={formData.firstName}
                  onChange={handleChange}
                />
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder={t.registerLastName}
                  type="text"
                  autoCapitalize="none"
                  autoComplete="family-name"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
              <Input
                id="email"
                name="email"
                placeholder={t.registerEmail}
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                value={formData.email}
                onChange={handleChange}
              />
              <Input
                id="password"
                name="password"
                placeholder={t.registerPassword}
                type="password"
                autoComplete="new-password"
                disabled={isLoading}
                value={formData.password}
                onChange={handleChange}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t.registerButton}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-center text-sm text-muted-foreground">
              {t.registerAlreadyHave}{' '}
              <Link
                href="/auth/login"
                className="underline underline-offset-4 hover:text-primary"
              >
                {t.registerSignIn}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}