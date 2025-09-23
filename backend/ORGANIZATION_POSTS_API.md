# 📝 API de Posts de Organizaciones

Sistema simple para que los clientes corporativos (líderes de organización) puedan crear posts informativos que todos los miembros de la organización pueden ver.

## 🎯 Resumen Simple

- **Solo el líder corporativo** puede crear, editar y gestionar posts
- **Todos los miembros** de la organización pueden ver los posts activos
- **Posts pueden tener** texto + enlace opcional
- **Posts pueden ser fijados** (aparecen primero)

---

## 📋 Modelo de Post

```python
OrganizationPost:
  - title: Título del post
  - content: Contenido/texto del post  
  - link_name: Nombre del enlace (opcional)
  - link_url: URL del enlace (opcional)
  - is_active: Si está activo/visible
  - is_pinned: Si está fijado en la parte superior
  - organization: Organización a la que pertenece
  - author: Cliente corporativo que lo creó
```

---

## 🚀 Endpoints Disponibles

### Para Clientes Corporativos (Líderes)

#### 1. Crear Post
```http
POST /api/organizations/{organization_id}/posts/create/
```
**Permisos:** Solo líder de la organización

**Cuerpo de la petición:**
```json
{
    "title": "Título del post",
    "content": "Contenido del post...",
    "link_name": "Ver más detalles",
    "link_url": "https://ejemplo.com/detalles",
    "is_pinned": false
}
```

**Respuesta exitosa:**
```json
{
    "message": "Post creado exitosamente",
    "post": {
        "id": 1,
        "title": "Título del post",
        "content": "Contenido del post...",
        "link_name": "Ver más detalles",
        "link_url": "https://ejemplo.com/detalles",
        "has_link": true,
        "is_active": true,
        "is_pinned": false,
        "created_at": "2025-09-22T20:00:00Z"
    }
}
```

#### 2. Listar Posts (Gestión)
```http
GET /api/organizations/{organization_id}/posts/
```
**Permisos:** Solo líder de la organización

**Parámetros opcionales:**
- `is_active=true/false` - Filtrar por estado
- `is_pinned=true/false` - Filtrar posts fijados
- `search=texto` - Buscar en título/contenido
- `page=1` - Número de página
- `page_size=10` - Posts por página

#### 3. Ver Detalles de Post
```http
GET /api/organizations/{organization_id}/posts/{post_id}/
```
**Permisos:** Solo líder de la organización

#### 4. Actualizar Post
```http
PUT /api/organizations/{organization_id}/posts/{post_id}/update/
```
**Permisos:** Solo líder de la organización

**Cuerpo de la petición:**
```json
{
    "title": "Título actualizado",
    "content": "Contenido actualizado...",
    "link_name": "Nuevo enlace",
    "link_url": "https://nuevo-enlace.com",
    "is_active": true,
    "is_pinned": true
}
```

#### 5. Eliminar Post
```http
DELETE /api/organizations/{organization_id}/posts/{post_id}/delete/
```
**Permisos:** Solo líder de la organización

#### 6. Fijar/Desfijar Post
```http
POST /api/organizations/{organization_id}/posts/{post_id}/toggle-pin/
```
**Permisos:** Solo líder de la organización

**Respuesta:**
```json
{
    "message": "Post fijado exitosamente",
    "post": { ... }
}
```

#### 7. Activar/Desactivar Post
```http
POST /api/organizations/{organization_id}/posts/{post_id}/toggle-status/
```
**Permisos:** Solo líder de la organización

---

### Para Miembros de la Organización

#### 8. Ver Posts Públicos
```http
GET /api/organizations/{organization_id}/posts/public/
```
**Permisos:** Miembros de la organización + líder

**Parámetros opcionales:**
- `search=texto` - Buscar en título/contenido
- `page=1` - Número de página
- `page_size=10` - Posts por página

**Respuesta:**
```json
{
    "results": [
        {
            "id": 1,
            "title": "Post importante",
            "content": "Contenido del post...",
            "link_name": "Ver más",
            "link_url": "https://ejemplo.com",
            "has_link": true,
            "is_pinned": true,
            "author_name": "Juan Pérez",
            "created_at": "2025-09-22T20:00:00Z"
        }
    ],
    "count": 5,
    "next": null,
    "previous": null
}
```

**Nota:** Solo se muestran posts activos (`is_active=true`)

---

## 🔒 Sistema de Permisos

### Cliente Corporativo (Líder)
- ✅ Crear posts
- ✅ Ver todos los posts (activos e inactivos)
- ✅ Editar posts
- ✅ Eliminar posts
- ✅ Fijar/desfijar posts
- ✅ Activar/desactivar posts

### Miembros de la Organización
- ✅ Ver posts activos
- ❌ No pueden crear/editar/eliminar

### Usuarios Externos
- ❌ Sin acceso a posts

---

## 📱 Casos de Uso

### 1. Anuncio General
```json
{
    "title": "Nueva Política de Trabajo Remoto",
    "content": "A partir del próximo mes implementaremos nuevas políticas...",
    "is_pinned": true
}
```

### 2. Compartir Documento
```json
{
    "title": "Manual de Procedimientos Actualizado",
    "content": "Hemos actualizado el manual con los nuevos procedimientos...",
    "link_name": "Descargar Manual PDF",
    "link_url": "https://docs.empresa.com/manual-v2.pdf"
}
```

### 3. Notificación Simple
```json
{
    "title": "Reunión Semanal",
    "content": "Recordatorio: reunión semanal mañana a las 10 AM"
}
```

---

## 🎨 Características Especiales

### Posts Fijados
- Posts con `is_pinned=true` aparecen **primero** en el listado
- Útil para anuncios importantes

### Links Opcionales
- Si `link_name` y `link_url` están presentes → `has_link=true`
- Si solo uno está presente → Error de validación
- Si ambos están vacíos → `has_link=false`

### Ordenamiento
- **Posts fijados primero**
- Luego por **fecha de creación** (más recientes primero)

### Paginación
- Por defecto: 10 posts por página
- Máximo: 100 posts por página

---

## ✅ Flujo de Trabajo

1. **Cliente corporativo** crea una organización
2. **Cliente corporativo** invita miembros
3. **Cliente corporativo** crea posts informativos
4. **Miembros** ven los posts en el dashboard de la organización
5. **Cliente corporativo** puede fijar posts importantes
6. **Cliente corporativo** puede desactivar posts obsoletos

---

## 🔧 Validaciones

- ✅ Solo el líder puede gestionar posts
- ✅ Título y contenido son obligatorios
- ✅ Links deben tener nombre Y URL (o ninguno)
- ✅ Usuario debe ser miembro para ver posts públicos
- ✅ Posts inactivos no aparecen en vista pública

---

¡Sistema simple y efectivo para comunicación interna en organizaciones! 🎉

