'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    const planParam = searchParams.get('plan');
    const sessionParam = searchParams.get('session_id');
    
    if (planParam) {
      setPlan(decodeURIComponent(planParam));
    }
    if (sessionParam) {
      setSessionId(sessionParam);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-800">
            ¡Pago Exitoso!
          </CardTitle>
          <CardDescription className="text-gray-600">
            Tu suscripción ha sido activada correctamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Plan seleccionado:</p>
            <p className="font-semibold text-gray-800">{plan || 'Plan Professional'}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">ID de sesión:</p>
            <p className="font-mono text-xs text-gray-800 break-all">{sessionId || 'test_session_123'}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">
              Gracias por confiar en KutchenAI. Tu asistente de IA está listo para ayudarte a optimizar tu restaurante.
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/auth/register">
                  Crear mi cuenta
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  Volver al inicio
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 