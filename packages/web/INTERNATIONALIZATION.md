# Sistema de Internacionalización (i18n)

Este documento describe la implementación del sistema de switching de idioma en la aplicación KutchenAI.

## Arquitectura

### 1. Contexto de Idioma (`use-language.tsx`)

El sistema utiliza un contexto de React para manejar el estado del idioma globalmente:

```typescript
interface LanguageContextType {
  language: Language
  changeLanguage: (newLanguage: Language) => void
  t: (key: string) => string
  tNested: (path: string) => any
}
```

### 2. Funciones de Traducción

- **`t(key: string)`**: Para traducciones simples (ej: `t('login')`)
- **`tNested(path: string)`**: Para traducciones anidadas (ej: `tNested('dashboard.totalSales')`)

### 3. Estructura de Traducciones (`translations.ts`)

Las traducciones están organizadas por idioma y sección:

```typescript
export const translations = {
  es: {
    login: "Iniciar sesión",
    dashboard: {
      title: "Dashboard",
      totalSales: "Ventas Totales",
      // ...
    },
    sidebar: {
      dashboard: "Dashboard",
      orders: "Órdenes",
      // ...
    }
  },
  en: {
    login: "Sign In",
    dashboard: {
      title: "Dashboard", 
      totalSales: "Total Sales",
      // ...
    },
    sidebar: {
      dashboard: "Dashboard",
      orders: "Orders", 
      // ...
    }
  }
}
```

## Componentes Implementados

### 1. LanguageSwitch
- Ubicación: `components/language-switch.tsx`
- Funcionalidad: Selector de idioma con banderas
- Uso: Se incluye en el header y sidebar

### 2. LanguageProvider
- Ubicación: `hooks/use-language.tsx`
- Funcionalidad: Proveedor del contexto de idioma
- Uso: Envuelve toda la aplicación en `layout.tsx`

## Páginas Traducidas

### ✅ Completadas
1. **Landing Page** (`/`)
   - Header, hero section, features, benefits, CTA, footer
   
2. **Dashboard** (`/admin/dashboard`)
   - Títulos, tabs, métricas, gráficos, tablas
   
3. **Sidebar** (`components/admin/sidebar.tsx`)
   - Navegación principal
   
4. **User Menu** (`components/user-menu.tsx`)
   - Opciones del menú de usuario
   
5. **Login** (`/auth/login`)
   - Formulario completo
   
6. **Register** (`/auth/register`)
   - Formulario completo

### 🔄 Pendientes
- Todas las demás páginas de la aplicación admin
- Páginas de configuración
- Páginas de gestión (productos, categorías, etc.)
- Mensajes de error y notificaciones
- Contenido dinámico (nombres de productos, categorías, etc.)

## Uso en Componentes

### Para traducciones simples:
```typescript
import { useLanguage } from "@/hooks/use-language"

export function MyComponent() {
  const { t } = useLanguage()
  
  return <h1>{t('dashboard.title')}</h1>
}
```

### Para traducciones anidadas:
```typescript
import { useLanguage } from "@/hooks/use-language"

export function MyComponent() {
  const { tNested } = useLanguage()
  
  const dashboardTranslations = tNested('dashboard')
  
  return (
    <div>
      <h1>{dashboardTranslations.title}</h1>
      <p>{dashboardTranslations.totalSales}</p>
    </div>
  )
}
```

### Para listas y arrays:
```typescript
const features = tNested('features')
const benefits = tNested('benefits')

return (
  <div>
    {features.map((feature, index) => (
      <div key={index}>
        <h3>{feature.title}</h3>
        <p>{feature.desc}</p>
      </div>
    ))}
  </div>
)
```

## Persistencia

- El idioma seleccionado se guarda en `localStorage`
- Se recupera automáticamente al cargar la aplicación
- Se actualiza el atributo `lang` del HTML dinámicamente

## Escalabilidad

### Para agregar un nuevo idioma:

1. Agregar el idioma en `translations.ts`:
```typescript
fr: {
  login: "Se connecter",
  dashboard: {
    title: "Tableau de bord",
    // ...
  }
}
```

2. Actualizar el componente `LanguageSwitch`:
```typescript
const languages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
]
```

3. Actualizar el tipo `Language`:
```typescript
type Language = 'es' | 'en' | 'fr'
```

### Para agregar nuevas traducciones:

1. Agregar las claves en `translations.ts` para todos los idiomas soportados
2. Usar las funciones `t()` o `tNested()` en los componentes
3. Mantener consistencia en la estructura de claves

## Mejores Prácticas

1. **Organización**: Agrupar traducciones por sección (dashboard, sidebar, etc.)
2. **Consistencia**: Usar las mismas claves en todos los idiomas
3. **Fallbacks**: El sistema usa español como idioma por defecto
4. **Tipado**: Usar TypeScript para detectar errores en las claves
5. **Testing**: Verificar que todas las traducciones se muestren correctamente

## Próximos Pasos

1. **Automatización**: Implementar extracción automática de textos
2. **Validación**: Agregar validación de traducciones faltantes
3. **Pluralización**: Implementar soporte para plurales
4. **Formateo**: Agregar soporte para fechas, números y monedas
5. **RTL**: Implementar soporte para idiomas de derecha a izquierda 