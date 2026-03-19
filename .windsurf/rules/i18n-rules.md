---
trigger: model_decision
description: Internationalization (i18n) best practices for Django, Next.js, and Nuxt projects. Use when working with translations, locale switching, multilingual content, date/number formatting, or RTL support.
---

# i18n Rules — Django / Next.js / Nuxt

## Core Principle

NEVER hardcode user-facing strings. Every text the user sees must go through the translation system.

```typescript
// ✅ Translated
<h1>{t('products.title')}</h1>
<button>{t('common.addToCart')}</button>

// ❌ Hardcoded
<h1>Nuestros Productos</h1>
<button>Add to Cart</button>
```

## Django i18n

### Setup

```python
# settings.py
from django.utils.translation import gettext_lazy as _

LANGUAGE_CODE = 'es'
USE_I18N = True
USE_L10N = True

LANGUAGES = [
    ('es', _('Español')),
    ('en', _('English')),
]

LOCALE_PATHS = [
    BASE_DIR / 'locale',
]

MIDDLEWARE = [
    ...
    'django.middleware.locale.LocaleMiddleware',  # after SessionMiddleware, before CommonMiddleware
    ...
]
```

### Usage in Python

```python
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy as _

# ✅ In views (runtime translation)
def order_view(request):
    message = _('Your order has been confirmed')
    return JsonResponse({'message': message})

# ✅ In models (lazy translation — evaluated at render time)
class Product(models.Model):
    name = models.CharField(_('product name'), max_length=200)

    class Meta:
        verbose_name = _('product')
        verbose_name_plural = _('products')

# ✅ With variables
message = _('Hello %(name)s, you have %(count)d items') % {
    'name': user.name,
    'count': cart.item_count,
}

# ❌ Don't translate then concatenate
message = _('Hello') + ' ' + user.name  # breaks translation context
```

### Usage in Templates

```html
{% load i18n %}

<!-- ✅ Simple translation -->
<h1>{% trans "Welcome to our store" %}</h1>

<!-- ✅ With variables -->
{% blocktrans with name=user.name count=cart.count %}
  Hello {{ name }}, you have {{ count }} items in your cart.
{% endblocktrans %}

<!-- ✅ Pluralization -->
{% blocktrans count counter=cart.count %}
  {{ counter }} item in your cart.
{% plural %}
  {{ counter }} items in your cart.
{% endblocktrans %}
```

### Generate Translation Files

```bash
# Create/update .po files
python manage.py makemessages -l en -l es

# Compile .po to .mo (after translating)
python manage.py compilemessages
```

### File Structure

```
locale/
├── en/
│   └── LC_MESSAGES/
│       ├── django.po     ← translate here
│       └── django.mo     ← compiled (auto-generated)
├── es/
│   └── LC_MESSAGES/
│       ├── django.po
│       └── django.mo
```

## Next.js i18n (with next-intl)

### Setup

```bash
npm install next-intl
```

```typescript
// messages/es.json
{
  "common": {
    "addToCart": "Agregar al carrito",
    "search": "Buscar",
    "loading": "Cargando..."
  },
  "products": {
    "title": "Nuestros Productos",
    "empty": "No se encontraron productos",
    "price": "Precio: {price, number, ::currency/COP}"
  },
  "cart": {
    "items": "{count, plural, =0 {Carrito vacío} one {# artículo} other {# artículos}}"
  }
}

// messages/en.json
{
  "common": {
    "addToCart": "Add to Cart",
    "search": "Search",
    "loading": "Loading..."
  },
  "products": {
    "title": "Our Products",
    "empty": "No products found",
    "price": "Price: {price, number, ::currency/USD}"
  },
  "cart": {
    "items": "{count, plural, =0 {Empty cart} one {# item} other {# items}}"
  }
}
```

### Usage in Components

```typescript
// app/[locale]/products/page.tsx
import { useTranslations } from 'next-intl'

export default function ProductsPage() {
  const t = useTranslations('products')

  return (
    <div>
      <h1>{t('title')}</h1>

      {/* With variables */}
      <p>{t('price', { price: product.price })}</p>

      {/* Pluralization */}
      <span>{t('cart.items', { count: cart.length })}</span>
    </div>
  )
}
```

### Routing

```
app/
├── [locale]/
│   ├── layout.tsx         ← wraps with NextIntlClientProvider
│   ├── page.tsx           ← home per locale
│   └── products/
│       └── page.tsx
```

URLs become: `/es/products`, `/en/products`

## Nuxt i18n (with @nuxtjs/i18n)

### Setup

```bash
npx nuxi module add @nuxtjs/i18n
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'es',
    lazy: true,
    langDir: 'locales/',
    strategy: 'prefix_except_default',
  },
})
```

```
locales/
├── es.json
└── en.json
```

### Usage in Components

```vue
<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
</script>

<template>
  <h1>{{ $t('products.title') }}</h1>

  <!-- With variables -->
  <p>{{ $t('products.price', { price: product.price }) }}</p>

  <!-- Pluralization -->
  <span>{{ $t('cart.items', { count: cart.length }) }}</span>

  <!-- Locale switcher -->
  <select @change="setLocale($event.target.value)" :value="locale">
    <option value="es">Español</option>
    <option value="en">English</option>
  </select>

  <!-- Localized links -->
  <NuxtLinkLocale to="/products">{{ $t('nav.products') }}</NuxtLinkLocale>
</template>
```

URLs become: `/products` (español, default), `/en/products` (english)

## Translation File Organization

For projects with many translations, split by feature:

```
messages/ (or locales/)
├── es/
│   ├── common.json       ← shared (buttons, labels, errors)
│   ├── products.json     ← product feature
│   ├── cart.json          ← cart feature
│   ├── auth.json          ← login, register
│   └── admin.json         ← admin panel
├── en/
│   ├── common.json
│   ├── products.json
│   └── ...
```

## Date and Number Formatting

NEVER format dates/numbers manually. Use the Intl API or framework helpers.

```typescript
// ✅ Locale-aware formatting
const formattedDate = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date(order.createdAt))

const formattedPrice = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: locale === 'es' ? 'COP' : 'USD',
}).format(product.price)

// es → "15 de marzo de 2026", "$150.000"
// en → "March 15, 2026", "$150.00"

// ❌ Manual formatting
const date = `${day}/${month}/${year}`  // breaks per locale
const price = `$${amount.toFixed(2)}`   // wrong for COP
```

## SEO + i18n

```typescript
// Next.js — alternate language links
export const metadata = {
  alternates: {
    languages: {
      es: 'https://mitienda.com/es/products',
      en: 'https://mitienda.com/en/products',
    },
  },
}
```

```vue
<!-- Nuxt — automatic with @nuxtjs/i18n -->
<!-- Adds hreflang tags automatically -->
```

## Rules

- Every user-facing string must be translatable. No exceptions
- Translation keys use dot notation by feature: `products.addToCart`
- Never concatenate translated strings — use variables instead
- Always handle pluralization properly (not `item(s)`)
- Dates, numbers, and currencies use Intl API or framework formatters
- Default locale should be the primary audience language
- Lazy load translation files to reduce bundle size
- Keep translation keys in English even if default locale is Spanish
- Test with the longest language to catch UI overflow issues