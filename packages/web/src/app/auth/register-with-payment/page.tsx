'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { API_URL } from '@/lib/api';
import { Check, Shield, Zap } from 'lucide-react';

export default function RegisterWithPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
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

    // Obtener el plan seleccionado de localStorage
    const plan = localStorage.getItem('selectedPlan');
    if (plan) {
      setSelectedPlan(plan);
    }
  }, []);

  const plans = [
    {
      name: 'Starter',
      price: '$0',
      period: '/mes',
      description: 'Perfecto para empezar',
      features: [
        'Hasta 100 pedidos/mes',
        'Gestión básica de inventario',
        'Soporte por email',
        '1 ubicación'
      ],
      popular: false
    },
    {
      name: 'Professional',
      price: '$50',
      period: '/mes',
      description: 'Para restaurantes en crecimiento',
      features: [
        'Pedidos ilimitados',
        'Gestión avanzada de inventario',
        'Soporte prioritario',
        'Múltiples ubicaciones',
        'Analytics avanzados',
        'Integración con delivery'
      ],
      popular: true
    },
    {
      name: 'Enterprise',
      price: '$100',
      period: '/mes',
      description: 'Para cadenas de restaurantes',
      features: [
        'Todo de Professional',
        'Soporte 24/7',
        'API personalizada',
        'Onboarding dedicado',
        'Reportes personalizados',
        'Integraciones premium'
      ],
      popular: false
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlan) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un plan',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/payments/register-with-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          plan: selectedPlan,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Error en el registro';
        try {
          const error = await response.json();
          errorMsg = error.message || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirigir a Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No se pudo iniciar el pago');
      }
    } catch (error) {
      let errorMsg = 'Error desconocido';
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      toast({
        title: 'Error',
        description: errorMsg,
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
    <Suspense fallback={<div>Cargando...</div>}>
          <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image 
              src={businessIcon} 
              alt="KutchenAI Logo" 
              width={48} 
              height={48}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold text-gray-800">KutchenAI</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Registro y Pago
          </h1>
          <p className="text-gray-600">
            Completa tu registro y selecciona tu plan
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulario de registro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Información de la cuenta
              </CardTitle>
              <CardDescription>
                Crea tu cuenta de KutchenAI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="tenantName" className="text-sm font-medium">
                  Nombre del negocio *
                </label>
                <Input
                  id="tenantName"
                  name="tenantName"
                  type="text"
                  value={formData.tenantName}
                  onChange={handleChange}
                  placeholder="Mi Restaurante"
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  Nombre *
                </label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Juan"
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Apellido *
                </label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Pérez"
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email *
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="juan@restaurante.com"
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña *
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Avatar
                </label>
                <AvatarUpload
                  onImageUploaded={(url) => setFormData({ ...formData, avatar: url })}
                  currentImage={formData.avatar}
                  initials={getInitials()}
                />
              </div>
            </CardContent>
          </Card>

          {/* Selección de plan */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Selecciona tu plan
                </CardTitle>
                <CardDescription>
                  Elige el plan que mejor se adapte a tu negocio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPlan === plan.name
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPlan(plan.name)}
                    >
                      {selectedPlan === plan.name && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{plan.price}</div>
                          <div className="text-sm text-gray-500">{plan.period}</div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      
                      <ul className="space-y-1">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center text-sm">
                            <Check className="w-3 h-3 mr-2 text-green-500 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      
                      {plan.popular && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                            Más popular
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Información de seguridad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4" />
                  Pago seguro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  Procesado por Stripe
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Zap className="w-4 h-4" />
                  Acceso inmediato después del pago
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Botón de registro */}
        <div className="mt-8 text-center">
          <Button 
            size="lg" 
            className="w-full max-w-md bg-primary text-white hover:bg-primary-700 focus:bg-primary-800 focus:ring-2 focus:ring-primary-400 focus:outline-none"
            onClick={handleSubmit}
            disabled={isLoading || !selectedPlan}
          >
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            {selectedPlan === 'Starter' ? 'Crear cuenta gratuita' : 'Continuar al pago'}
          </Button>
          
          <p className="text-sm text-gray-500 mt-4">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
    </Suspense>

  );
} 