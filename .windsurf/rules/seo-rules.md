---
trigger: model_decision
description: SEO best practices for Next.js and Nuxt projects. Use when working with meta tags, head elements, sitemap, robots, Open Graph, structured data, SSR/SSG rendering decisions, or any public-facing pages.
---

# SEO Rules — Next.js & Nuxt

## Meta Tags

Every public page MUST have unique title, description, and canonical URL.

### Next.js (App Router)

```typescript
// app/products/[id]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id)

  return {
    title: `${product.name} | Mi Tienda`,
    description: product.description.slice(0, 155),
    alternates: {
      canonical: `https://mitienda.com/products/${params.id}`,
    },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 155),
      images: [{ url: product.image, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description.slice(0, 155),
      images: [product.image],
    },
  }
}

// ❌ No metadata = invisible to search engines
export default function ProductPage() {
  return <div>...</div>  // No title, no description
}
```

### Nuxt

```vue
<!-- pages/products/[id].vue -->
<script setup lang="ts">
const { data: product } = await useFetch(`/api/products/${route.params.id}`)

useHead({
  title: `${product.value.name} | Mi Tienda`,
  meta: [
    { name: 'description', content: product.value.description.slice(0, 155) },
  ],
  link: [
    { rel: 'canonical', href: `https://mitienda.com/products/${product.value.id}` },
  ],
})

useSeoMeta({
  ogTitle: product.value.name,
  ogDescription: product.value.description.slice(0, 155),
  ogImage: product.value.image,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: product.value.name,
  twitterImage: product.value.image,
})
</script>
```

## Title Pattern

Use a consistent pattern across all pages:

```
Home:     Mi Tienda — Productos artesanales de Colombia
Category: Bolsos | Mi Tienda
Product:  Bolso de Cuero Artesanal | Mi Tienda
Blog:     Cómo elegir un bolso de cuero — Mi Tienda Blog
404:      Página no encontrada | Mi Tienda
```

Rules:
- Max 60 characters (Google truncates after ~60)
- Primary keyword first, brand last
- Use `|` or `—` as separator, be consistent
- Every page has a UNIQUE title

## Description

- Max 155 characters
- Include primary keyword naturally
- Include a call to action when relevant
- Every page has a UNIQUE description
- Never duplicate the title

## SSR vs SSG vs ISR Decision

```
¿El contenido cambia con cada request?
  → SSR (Server-Side Rendering)
  Ej: dashboard, carrito, contenido personalizado

¿El contenido cambia poco (diario/semanal)?
  → ISR (Incremental Static Regeneration)
  Ej: productos, blog posts, categorías

¿El contenido nunca cambia?
  → SSG (Static Site Generation)
  Ej: about, terms, landing pages
```

### Next.js

```typescript
// SSG — build time
export const dynamic = 'force-static'

// SSR — every request
export const dynamic = 'force-dynamic'

// ISR — revalidate every hour
export const revalidate = 3600
```

### Nuxt

```vue
<script setup>
// SSR (default in Nuxt)
const { data } = await useFetch('/api/products')

// SSG
defineRouteRules({ prerender: true })

// ISR
defineRouteRules({ isr: 3600 })
</script>
```

## Sitemap

### Next.js

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProducts()

  const productUrls = products.map((product) => ({
    url: `https://mitienda.com/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    { url: 'https://mitienda.com', lastModified: new Date(), priority: 1 },
    { url: 'https://mitienda.com/about', priority: 0.5 },
    ...productUrls,
  ]
}
```

### Nuxt

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/sitemap'],
  sitemap: {
    hostname: 'https://mitienda.com',
  },
})
```

## Robots.txt

### Next.js

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/'],
    },
    sitemap: 'https://mitienda.com/sitemap.xml',
  }
}
```

### Nuxt

```
// public/robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/
Sitemap: https://mitienda.com/sitemap.xml
```

## Structured Data (JSON-LD)

```typescript
// Next.js — app/products/[id]/page.tsx
export default function ProductPage({ product }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'COP',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* page content */}
    </>
  )
}
```

## Images

- Always include `alt` text — descriptive, with keyword when natural
- Use Next.js `<Image>` or Nuxt `<NuxtImg>` for automatic optimization
- Use WebP/AVIF formats
- Set explicit `width` and `height` to prevent layout shift
- Lazy load below-the-fold images (default in both frameworks)

```typescript
// ✅ Next.js
<Image src={product.image} alt="Bolso de cuero artesanal color marrón" width={800} height={600} />

// ✅ Nuxt
<NuxtImg src="/products/bolso.webp" alt="Bolso de cuero artesanal color marrón" width="800" height="600" />

// ❌ No alt, no dimensions
<img src="/bolso.jpg" />
```

## URLs

- Use slugs, not IDs: `/products/bolso-cuero-artesanal` not `/products/123`
- Lowercase, hyphens, no underscores
- Keep URLs short and descriptive
- Implement proper 301 redirects when URLs change

## Checklist — Every Public Page

- [ ] Unique title (max 60 chars)
- [ ] Unique description (max 155 chars)
- [ ] Canonical URL
- [ ] Open Graph tags (title, description, image)
- [ ] Proper heading hierarchy (one H1, then H2, H3...)
- [ ] Images have alt text
- [ ] Structured data where applicable (Product, Article, FAQ)
- [ ] Correct rendering strategy (SSR/SSG/ISR)
- [ ] Page loads in <3 seconds
- [ ] Mobile responsive