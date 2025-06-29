'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Calendar, User, RefreshCw, MessageSquare, Check, X, Edit3, GripVertical, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { getCustomers, updateCustomer } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  neighborhood?: string;
  whatsappId?: string;
  createdAt: string;
  updatedAt: string;
}

interface EditableField {
  id: string;
  type: 'name' | 'phone' | 'address' | 'neighborhood';
  value: string;
  originalValue: string;
}

interface DragState {
  customerId: string;
  sourceField: EditableField['type'];
  targetField: EditableField['type'] | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingFields, setEditingFields] = useState<EditableField[]>([]);
  const [savingCustomer, setSavingCustomer] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers();
      setCustomers(data);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      
      // Check if the error is authentication related
      if (error.message?.includes('No authentication token found') || 
          error.message?.includes('Authentication expired') ||
          error.message?.includes('Unauthorized')) {
        setError("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      } else {
        setError("No se pudieron cargar los clientes. Por favor, intenta de nuevo.");
        toast({
          title: "Error",
          description: "No se pudieron cargar los clientes",
          variant: "destructive",
        });
      }
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
        await fetchCustomers();
      } else {
        toast({
          title: "Error en la sincronización",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error syncing WhatsApp:', error);
      
      // Check if the error is authentication related
      if (error.message?.includes('No authentication token found') || 
          error.message?.includes('Authentication expired') ||
          error.message?.includes('Unauthorized')) {
        toast({
          title: "Error de autenticación",
          description: "Tu sesión ha expirado. Redirigiendo al inicio de sesión...",
          variant: "destructive",
          duration: 3000
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: "No se pudo sincronizar con WhatsApp",
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const startEditing = (customerId: string, fieldType: EditableField['type'], value: string) => {
    const existingField = editingFields.find(f => f.id === customerId && f.type === fieldType);
    if (existingField) return;

    setEditingFields(prev => [...prev, {
      id: customerId,
      type: fieldType,
      value: value,
      originalValue: value
    }]);
  };

  const updateEditingField = (customerId: string, fieldType: EditableField['type'], value: string) => {
    setEditingFields(prev => 
      prev.map(field => 
        field.id === customerId && field.type === fieldType 
          ? { ...field, value } 
          : field
      )
    );
  };

  const cancelEditing = (customerId: string, fieldType: EditableField['type']) => {
    setEditingFields(prev => 
      prev.filter(field => !(field.id === customerId && field.type === fieldType))
    );
  };

  const saveCustomerChanges = async (customerId: string) => {
    const customerFields = editingFields.filter(field => field.id === customerId);
    if (customerFields.length === 0) return;

    setSavingCustomer(customerId);
    try {
      const updateData: any = {};
      customerFields.forEach(field => {
        if (field.value !== field.originalValue) {
          updateData[field.type] = field.value;
        }
      });

      if (Object.keys(updateData).length > 0) {
        await updateCustomer(customerId, updateData);
        
        // Update local state
        setCustomers(prev => 
          prev.map(customer => 
            customer.id === customerId 
              ? { ...customer, ...updateData }
              : customer
          )
        );

        // Remove editing fields for this customer
        setEditingFields(prev => 
          prev.filter(field => field.id !== customerId)
        );

        toast({
          title: "¡Cliente actualizado!",
          description: "Los cambios se han guardado correctamente",
        });
      }
    } catch (error: any) {
      console.error('Error updating customer:', error);
      
      // Check if the error is authentication related
      if (error.message?.includes('No authentication token found') || 
          error.message?.includes('Authentication expired') ||
          error.message?.includes('Unauthorized')) {
        toast({
          title: "Error de autenticación",
          description: "Tu sesión ha expirado. Redirigiendo al inicio de sesión...",
          variant: "destructive",
          duration: 3000
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: "No se pudo actualizar el cliente",
          variant: "destructive",
        });
      }
    } finally {
      setSavingCustomer(null);
    }
  };

  const hasChanges = (customerId: string) => {
    const customerFields = editingFields.filter(field => field.id === customerId);
    return customerFields.some(field => field.value !== field.originalValue);
  };

  const getFieldValue = (customer: Customer, fieldType: EditableField['type']) => {
    const editingField = editingFields.find(f => f.id === customer.id && f.type === fieldType);
    return editingField ? editingField.value : customer[fieldType] || '';
  };

  // Drag and drop functionality
  const startDrag = (customerId: string, sourceField: EditableField['type']) => {
    setDragState({
      customerId,
      sourceField,
      targetField: null
    });
  };

  const handleDragOver = (e: React.DragEvent, targetField: EditableField['type']) => {
    e.preventDefault();
    if (dragState) {
      setDragState(prev => prev ? { ...prev, targetField } : null);
    }
  };

  const handleDrop = (customerId: string, targetField: EditableField['type']) => {
    if (!dragState || dragState.customerId !== customerId || dragState.sourceField === targetField) {
      setDragState(null);
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      setDragState(null);
      return;
    }

    const sourceValue = getFieldValue(customer, dragState.sourceField);
    const targetValue = getFieldValue(customer, targetField);

    // Swap the values
    const newUpdateData: any = {};
    newUpdateData[dragState.sourceField] = targetValue;
    newUpdateData[targetField] = sourceValue;

    // Update local state immediately
    setCustomers(prev => 
      prev.map(c => 
        c.id === customerId 
          ? { ...c, ...newUpdateData }
          : c
      )
    );

    // Add to editing fields for saving
    Object.entries(newUpdateData).forEach(([fieldType, value]) => {
      const existingField = editingFields.find(f => f.id === customerId && f.type === fieldType as EditableField['type']);
      if (!existingField) {
        setEditingFields(prev => [...prev, {
          id: customerId,
          type: fieldType as EditableField['type'],
          value: value as string,
          originalValue: customer[fieldType as keyof Customer] as string || ''
        }]);
      } else {
        setEditingFields(prev => 
          prev.map(field => 
            field.id === customerId && field.type === fieldType as EditableField['type']
              ? { ...field, value: value as string }
              : field
          )
        );
      }
    });

    setDragState(null);
    toast({
      title: "Campos intercambiados",
      description: `Se movió el contenido de ${dragState.sourceField} a ${targetField}`,
    });
  };

  const renderEditableField = (customer: Customer, fieldType: EditableField['type'], placeholder: string, icon: React.ReactNode) => {
    const isEditing = editingFields.some(f => f.id === customer.id && f.type === fieldType);
    const value = getFieldValue(customer, fieldType);
    const isDragging = dragState?.customerId === customer.id && dragState?.sourceField === fieldType;
    const isDragTarget = dragState?.customerId === customer.id && dragState?.targetField === fieldType;

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          {icon}
          <Input
            value={value}
            onChange={(e) => updateEditingField(customer.id, fieldType, e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveCustomerChanges(customer.id);
              } else if (e.key === 'Escape') {
                cancelEditing(customer.id, fieldType);
              }
            }}
          />
        </div>
      );
    }

    return (
      <div 
        className={`flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded transition-colors group relative ${
          isDragging ? 'opacity-50' : ''
        } ${isDragTarget ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-300' : ''}`}
        onClick={() => startEditing(customer.id, fieldType, value)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          startDrag(customer.id, fieldType);
        }}
        onDragOver={(e) => handleDragOver(e, fieldType)}
        onDrop={(e) => handleDrop(customer.id, fieldType)}
        onDragEnd={() => setDragState(null)}
      >
        <GripVertical className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        {icon}
        <span className="text-gray-700 dark:text-gray-300 break-words">
          {value || '-'}
        </span>
        <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isDragTarget && (
          <div className="absolute inset-0 bg-blue-200 dark:bg-blue-800 opacity-20 rounded pointer-events-none flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        )}
      </div>
    );
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
              Gestiona la información de tus clientes. Haz clic en cualquier campo para editarlo o arrastra para mover contenido entre campos.
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

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center text-red-500 mb-4">
              {error}
            </div>
            <Button onClick={fetchCustomers}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : customers && customers.length > 0 ? (
        <div className="grid gap-4 md:gap-6">
          {/* Vista de tarjetas para móviles */}
          <div className="grid grid-cols-1 md:hidden gap-4">
            {customers.map((customer: Customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {renderEditableField(customer, 'name', 'Nombre del cliente', <User className="h-4 w-4" />)}
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
                  <div className="space-y-2">
                    {renderEditableField(customer, 'phone', 'Número de teléfono', <Phone className="h-4 w-4" />)}
                  </div>
                  {renderEditableField(customer, 'address', 'Dirección', <MapPin className="h-4 w-4" />)}
                  {renderEditableField(customer, 'neighborhood', 'Barrio', <MapPin className="h-4 w-4" />)}
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Registrado: {new Date(customer.createdAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                  {hasChanges(customer.id) && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => saveCustomerChanges(customer.id)}
                        disabled={savingCustomer === customer.id}
                        className="flex items-center gap-1"
                      >
                        {savingCustomer === customer.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {savingCustomer === customer.id ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          editingFields
                            .filter(f => f.id === customer.id)
                            .forEach(f => cancelEditing(customer.id, f.type));
                        }}
                        className="flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Cancelar
                      </Button>
                    </div>
                  )}
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
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer: Customer, index: number) => (
                        <tr 
                          key={customer.id} 
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group ${
                            index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'
                          }`}
                        >
                          <td className="py-3 px-4">
                            {renderEditableField(customer, 'name', 'Nombre del cliente', <User className="h-4 w-4" />)}
                          </td>
                          <td className="py-3 px-4">
                            {renderEditableField(customer, 'phone', 'Número de teléfono', <Phone className="h-4 w-4" />)}
                          </td>
                          <td className="py-3 px-4">
                            {renderEditableField(customer, 'address', 'Dirección', <MapPin className="h-4 w-4" />)}
                          </td>
                          <td className="py-3 px-4">
                            {renderEditableField(customer, 'neighborhood', 'Barrio', <MapPin className="h-4 w-4" />)}
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
                          <td className="py-3 px-4">
                            {hasChanges(customer.id) && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => saveCustomerChanges(customer.id)}
                                  disabled={savingCustomer === customer.id}
                                  className="flex items-center gap-1"
                                >
                                  {savingCustomer === customer.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  {savingCustomer === customer.id ? 'Guardando...' : 'Guardar'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    editingFields
                                      .filter(f => f.id === customer.id)
                                      .forEach(f => cancelEditing(customer.id, f.type));
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
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