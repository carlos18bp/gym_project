# Módulo de Manual de Usuario

## 📋 Descripción

Este módulo proporciona un manual interactivo y contextual para guiar a los usuarios a través de todas las funcionalidades de la plataforma G&M Abogados, adaptado según su rol.

## 🏗️ Estructura de Archivos

```
/views/user_guide/
├── UserGuideMain.vue          # Vista principal
├── components/
│   ├── GuideNavigation.vue    # Navegación lateral por módulos
│   ├── ModuleGuide.vue        # Contenido del módulo seleccionado
│   ├── SearchGuide.vue        # Búsqueda en el manual
│   ├── RoleInfoCard.vue       # Tarjeta de información del rol
│   └── QuickLinksCard.vue     # Enlaces rápidos a módulos
└── README.md                  # Este archivo

/stores/user_guide/
├── index.js                   # Define el store Pinia y ensambla guideContent
├── modules.js                 # Lista de módulos (id, name, icon, roles)
├── getters.js                 # getModulesForRole, getModuleContent, searchGuideContent
└── content/
    ├── dashboard_directory.js # Dashboard + Directorio
    ├── processes.js           # Procesos judiciales
    ├── documents.js           # Archivos Jurídicos / Documentos dinámicos
    ├── secop.js               # SECOP — Contratación Estatal
    ├── services_tramites.js   # Servicios y Trámites
    └── services.js            # Solicitudes, Citas, Organizaciones, Intranet, Auth, Suscripciones
```

## ✨ Características Implementadas

### 1. Navegación Contextual por Rol
- ✅ Muestra solo los módulos disponibles para el rol del usuario
- ✅ Filtrado automático de contenido según permisos
- ✅ Badge visual del rol actual

### 2. Búsqueda Inteligente
- ✅ Búsqueda en tiempo real (mínimo 3 caracteres)
- ✅ Resultados con snippet de contexto
- ✅ Navegación directa al contenido encontrado
- ✅ Búsqueda en módulos, secciones y funcionalidades

### 3. Contenido Rico
- ✅ Descripción general de cada módulo
- ✅ Secciones detalladas con:
  - Lista de funcionalidades
  - Guías paso a paso
  - Consejos y tips
  - Restricciones por rol
- ✅ Formato HTML enriquecido

### 4. Responsive Design
- ✅ Vista de escritorio con sidebar fijo
- ✅ Vista móvil con menú desplegable
- ✅ Adaptación automática de contenido

### 5. Enlaces Rápidos
- ✅ Tarjeta de información del rol
- ✅ Enlaces a módulos más usados
- ✅ Acceso rápido a ayuda

## 🎯 Roles Soportados

- **Lawyer (Abogado)**: Acceso a todos los módulos
- **Client (Cliente)**: Módulos de consulta y solicitud
- **Corporate Client (Cliente Corporativo)**: Módulos de cliente + organizaciones
- **Basic (Básico)**: Módulos básicos limitados

## 📝 Cómo Agregar Contenido

### 1. Agregar un Nuevo Módulo

1. Crea `stores/user_guide/content/<nombre>.js` exportando un `<nombre>Content` con `{ name, icon, description, overview, sections }`.
2. Registra la entrada correspondiente en `stores/user_guide/modules.js` (`id`, `name`, `icon`, `roles`, `description`).
3. Importa y fusiona el contenido en `stores/user_guide/index.js` dentro de `initializeGuideContent()`:

```javascript
this.guideContent = {
  // ... módulos existentes
  
  nuevo_modulo: {
    name: 'Nombre del Módulo',
    icon: IconComponent,
    description: 'Descripción breve',
    overview: `<p>Descripción detallada en HTML</p>`,
    sections: [
      {
        id: 'seccion-1',
        name: 'Nombre de la Sección',
        description: 'Descripción de la sección',
        roles: ['lawyer', 'client'], // Roles que pueden ver esta sección
        content: `<p>Contenido en HTML</p>`,
        features: [
          'Funcionalidad 1',
          'Funcionalidad 2'
        ],
        steps: [
          {
            title: 'Paso 1',
            description: 'Descripción del paso'
          }
        ],
        tips: [
          'Consejo útil 1',
          'Consejo útil 2'
        ],
        restrictions: [
          'Restricción para ciertos roles'
        ]
      }
    ]
  }
};
```

### 2. Agregar el Módulo a la Lista

En el getter `getModulesForRole`, agrega el nuevo módulo:

```javascript
const allModules = [
  // ... módulos existentes
  {
    id: 'nuevo_modulo',
    name: 'Nombre del Módulo',
    icon: IconComponent,
    roles: ['lawyer', 'client'], // Roles que pueden acceder
    description: 'Descripción breve'
  }
];
```

## 🔍 Búsqueda

La búsqueda funciona automáticamente en:
- Nombres de módulos
- Descripciones de módulos
- Nombres de secciones
- Contenido de secciones
- Lista de funcionalidades

No requiere configuración adicional.

## 🎨 Personalización

### Cambiar Colores

Los colores principales se pueden modificar en los componentes:
- `text-indigo-600`: Color principal
- `bg-indigo-50`: Fondo claro
- `border-indigo-200`: Bordes

### Agregar Iconos

Importa desde `@heroicons/vue/24/outline`:

```javascript
import { NewIcon } from '@heroicons/vue/24/outline';
```

## 📱 Responsive

El módulo es completamente responsive:
- **Desktop (lg+)**: Sidebar fijo + contenido
- **Tablet (md)**: Sidebar colapsable
- **Mobile (sm)**: Menú desplegable completo

## 🚀 Próximas Mejoras Sugeridas

1. **Videos Tutoriales**
   - Integrar videos embebidos
   - Player personalizado

2. **Modo Interactivo**
   - Tours guiados paso a paso
   - Highlights en la interfaz real

3. **Favoritos**
   - Marcar secciones favoritas
   - Historial de consultas

4. **Feedback**
   - Botón "¿Fue útil?"
   - Comentarios por sección

5. **Exportar**
   - Descargar sección como PDF
   - Imprimir guía completa

6. **Multiidioma**
   - Soporte para inglés
   - Detección automática de idioma

7. **Búsqueda Avanzada**
   - Filtros por rol
   - Filtros por tipo de contenido
   - Búsqueda con operadores

## 🐛 Debugging

### El contenido no se muestra
- Verifica que `guideStore.initializeGuideContent()` se llama en `onMounted`
- Revisa la consola por errores de sintaxis en el HTML

### La búsqueda no funciona
- Asegúrate de escribir al menos 3 caracteres
- Verifica que el contenido esté en `guideContent`

### Los módulos no se filtran por rol
- Confirma que el rol del usuario es correcto
- Verifica el array `roles` en cada módulo

## 📞 Soporte

Para agregar más contenido o modificar funcionalidades, consulta:
- `/MANUAL_USUARIO_POR_ROL.md` - Contenido completo por rol
- `/MAPEO_TECNICO_FUNCIONALIDADES.md` - Detalles técnicos
- `/FUNCIONALIDADES_DETALLADAS_REVISION.md` - Funcionalidades adicionales

---

**Última actualización**: Abr 22, 2026  
**Versión**: 1.1.0 — añadidos módulos SECOP y Servicios y Trámites (12 módulos totales)  
**Estado**: ✅ Implementado y funcional
