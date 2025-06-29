'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Calendar, User, RefreshCw, MessageSquare, Plus, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCustomers } from '@/lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    neighborhood: ''
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncWhatsApp = async () => {
    setSyncing(true);
    try {
      const locationId = user?.locationId;
      if (!locationId) {
        toast({
          title: "Error",
          description: "No tienes una ubicación asignada. Contacta al administrador.",
          variant: "destructive",
        });
        return;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/customers/sync-whatsapp/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      
      if (!res.ok) throw new Error('Error en la sincronización');
      
      const result = await res.json();
      
      if (result.success) {
        toast({
          title: "¡Sincronización exitosa!",
          description: result.message,
        });
        // Recargar la lista de clientes
        await fetchCustomers();
      } else {
        toast({
          title: "Error en la sincronización",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo sincronizar con WhatsApp",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);
  
  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Clientes
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Gestiona la información de tus clientes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={syncWhatsApp}
              disabled={syncing}
              className="flex items-center gap-2"
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              {syncing ? 'Sincronizando...' : 'Sync WhatsApp'}
            </Button>
            <Button
              variant="outline"
              onClick={fetchCustomers}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {customers && customers.length > 0 ? (
        <div className="grid gap-4 md:gap-6">
          {/* Vista de tarjetas para móviles */}
          <div className="grid grid-cols-1 md:hidden gap-4">
            {customers.map((customer: any) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {customer.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      {customer.whatsappId && (
                        <Badge variant="secondary" className="text-xs">
                          WhatsApp
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Cliente
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="h-4 w-4" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.address && (
                    <div className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="break-words">{customer.address}</span>
                    </div>
                  )}
                  {customer.neighborhood && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>{customer.neighborhood}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Registrado: {new Date(customer.createdAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Vista de tabla para tablets y desktop */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Lista de Clientes ({customers.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Nombre
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Teléfono
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Dirección
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Barrio
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          WhatsApp
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Fecha de Registro
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer: any, index: number) => (
                        <tr 
                          key={customer.id} 
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                            index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {customer.name}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {customer.phone}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-start space-x-2">
                              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700 dark:text-gray-300 break-words max-w-xs">
                                {customer.address || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-700 dark:text-gray-300">
                              {customer.neighborhood || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {customer.whatsappId ? (
                              <Badge variant="secondary" className="text-xs">
                                Conectado
                              </Badge>
                            ) : (
                              <span className="text-gray-500 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {new Date(customer.createdAt).toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay clientes registrados
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">
              Los clientes aparecerán aquí cuando se registren a través de WhatsApp o se agreguen manualmente.
            </p>
            <Button onClick={syncWhatsApp} disabled={syncing} className="flex items-center gap-2">
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              {syncing ? 'Sincronizando...' : 'Sync WhatsApp'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 