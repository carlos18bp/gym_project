# Propuesta de Desarrollo - Nuevos Requerimientos
## G&M Consultores Jurídicos

---

## Resumen de Requerimientos y Precios

| # | Requerimiento | Dificultad | Descripción | Precio Total (COP) |
|---|---------------|------------|-------------|-------------------|
| 1 | Reasignación de Datos de Abogado | Medio-Alto | Módulo de administración para transferir procesos y documentos entre abogados, con opción de archivar usuarios | 2,700,000 |
| 2 | Gestión de Minutas - Visibilidad Compartida | Medio | Permite a todos los abogados ver las minutas del equipo y crear copias para uso propio | 1,600,000 |
| 3 | Previsualización de Plantillas | Bajo-Medio | Vista previa de plantillas antes de usarlas, con variables mostradas de forma legible | 800,000 |
| 4 | Tour Guiado / Onboarding Interactivo | Medio | Guía paso a paso para nuevos usuarios, diferenciada por rol (abogado/cliente) | 1,800,000 |
| 5 | Centro de Notificaciones | Medio-Alto | Bandeja centralizada para ver y gestionar todas las notificaciones de la plataforma | 2,400,000 |
| 6 | Alertas en Archivos Jurídicos | Medio | Indicadores visuales y recordatorios por email para documentos pendientes de firma | 1,800,000 |
| 7 | Alertas en Procesos Jurídicos | Medio-Alto | Recordatorios automáticos antes de fechas importantes de estados procesales | 2,400,000 |
| 8 | Autenticación con Microsoft/Outlook | Medio | Inicio de sesión con cuentas de Microsoft (Outlook, Hotmail, Microsoft 365) | 1,100,000 |
| 9 | Marketplace de Servicios | Alto | Módulo para listar, consultar y solicitar los servicios ofrecidos por la firma, con formulario dinámico de solicitud por servicio y gestión de servicios por rol | 3,200,000 |
| 10 | Firmantes Requeridos e Informativos | Medio | Excepción en el flujo de firma electrónica que permite marcar firmantes como requeridos u optativos, sin bloquear la finalización del documento por los firmantes informativos | 1,260,000 |
| 11 | Ejecución del Contrato — Cuentas de Cobro | Medio-Alto | Submódulo en documentos completamente firmados para cargar, revisar, aceptar o rechazar cuentas de cobro por cada cuota pactada, con notificaciones automáticas y resumen contable de pagos | 2,520,000 |

---

## Inversión Total

| Concepto | Valor (COP) |
|----------|-------------|
| Requerimientos #1 al #8 | 14,600,000 |
| Requerimientos #9 al #11 | 6,980,000 |
| **Total 11 Requerimientos** | **21,580,000** |

---

## Dependencias entre Requerimientos

Es importante considerar el orden de implementación de algunos requerimientos, ya que existen dependencias técnicas que afectan la secuencia de desarrollo:

### Centro de Notificaciones como Base del Sistema de Alertas

El **Requerimiento #5 (Centro de Notificaciones)** debe implementarse **antes** de los requerimientos de alertas (#6 y #7). Esto se debe a que:

- El Centro de Notificaciones establece la **infraestructura central** donde se almacenan y gestionan todas las notificaciones de la plataforma.

- Los módulos de **Alertas en Archivos Jurídicos (#6)** y **Alertas en Procesos (#7)** utilizan esta infraestructura para enviar sus notificaciones a los usuarios.

- Sin el Centro de Notificaciones implementado, las alertas no tendrían dónde mostrarse dentro de la plataforma (solo funcionarían los emails, perdiendo la funcionalidad de notificaciones in-app).

### Diagrama de Dependencias

```
┌─────────────────────────────────────┐
│  #5 Centro de Notificaciones        │  ◄── Debe implementarse PRIMERO
│  (Base del sistema de alertas)      │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│ #6 Alertas   │ │ #7 Alertas   │
│ Archivos     │ │ Procesos     │
│ Jurídicos    │ │ Jurídicos    │
└──────────────┘ └──────────────┘
```

### Requerimientos Independientes

Los siguientes requerimientos **no tienen dependencias** y pueden implementarse en cualquier orden o en paralelo:

- **#1** - Reasignación de Datos de Abogado
- **#2** - Gestión de Minutas
- **#3** - Previsualización de Plantillas
- **#4** - Tour Guiado / Onboarding
- **#8** - Autenticación con Microsoft/Outlook
- **#9** - Marketplace de Servicios
- **#10** - Firmantes Requeridos e Informativos
- **#11** - Ejecución del Contrato — Cuentas de Cobro

### Orden de Implementación Sugerido

Considerando las dependencias y el valor de negocio, sugerimos el siguiente orden:

| Fase | Requerimiento | Justificación |
|------|---------------|---------------|
| 1 | #5 Centro de Notificaciones | Base necesaria para el sistema de alertas |
| 2 | #6 Alertas en Archivos Jurídicos | Aprovecha inmediatamente el Centro de Notificaciones |
| 3 | #7 Alertas en Procesos Jurídicos | Completa el sistema de alertas |
| 4 | #1 Reasignación de Datos | Alta utilidad para gestión del equipo |
| 5 | #2 Gestión de Minutas | Mejora colaboración entre abogados |
| 6 | #4 Tour Guiado | Mejora experiencia de nuevos usuarios |
| 7 | #3 Previsualización de Plantillas | Mejora usabilidad |
| 8 | #8 Autenticación Microsoft | Amplía opciones de acceso |
| 9 | #9 Marketplace de Servicios | Nuevo canal de captación y gestión de solicitudes de servicios |
| 10 | #10 Firmantes Requeridos e Informativos | Mejora la flexibilidad del flujo de firma electrónica |
| 11 | #11 Ejecución del Contrato — Cuentas de Cobro | Cierra el ciclo del contrato con seguimiento de pagos |

*Nota: El orden de los requerimientos independientes (fases 4-11) es flexible y puede ajustarse según las prioridades del negocio.*

---

## Notas Adicionales

- Todos los requerimientos incluyen desarrollo para **aplicación web y móvil**.
- Cada requerimiento incluye la **actualización del manual de usuario** correspondiente.
- Los precios incluyen **desarrollo, pruebas y documentación**.

---

*Propuesta válida por 30 días a partir de la fecha de emisión.*