---
trigger: model_decision
description: Tailwind CSS best practices for Vue, Nuxt, React, and Next.js projects. Use when working with Tailwind utility classes, responsive design, dark mode, component styling, or tailwind.config files.
---

# Tailwind CSS Development Rules

## Class Ordering

Follow consistent order: layout → position → spacing → sizing → typography → visual → interactive

```
<!-- ✅ Correct order -->
<div class="flex items-center justify-between gap-4 px-6 py-4 w-full text-sm font-medium text-gray-900 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">

<!-- ❌ Random order -->
<div class="shadow-sm text-sm flex bg-white py-4 hover:shadow-md items-center rounded-lg px-6 gap-4 w-full font-medium">
```

## Responsive Design

Always mobile-first. Never use `max-*` breakpoints unless absolutely necessary.

```html
<!-- ✅ Mobile-first -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

<!-- ❌ Desktop-first -->
<div class="grid grid-cols-3 sm:grid-cols-1">
```

Breakpoint order: `sm:` → `md:` → `lg:` → `xl:` → `2xl:`

## Dark Mode

Use `dark:` variant consistently. Define color pairs for every visible element.

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <p class="text-gray-600 dark:text-gray-400">Subtle text</p>
  <div class="border border-gray-200 dark:border-gray-700">Card</div>
</div>
```

## @apply Usage

Use `@apply` ONLY for base component styles that repeat 5+ times. Prefer utility classes inline.

```css
/* ✅ Reusable base component */
.btn-primary {
  @apply px-4 py-2 font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

/* ❌ Don't @apply everything */
.my-card {
  @apply mt-4 p-2;  /* Just use the classes inline */
}
```

## Conditional Classes

### In React/Next.js
Use `cn()` from `clsx` + `tailwind-merge` or just `clsx`:

```tsx
import { cn } from '@/lib/utils'

<button className={cn(
  "px-4 py-2 rounded-lg font-medium transition-colors",
  variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
  variant === "ghost" && "bg-transparent hover:bg-gray-100",
  disabled && "opacity-50 cursor-not-allowed"
)}>

// utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### In Vue/Nuxt
Use array syntax or computed:

```vue
<template>
  <button :class="[
    'px-4 py-2 rounded-lg font-medium transition-colors',
    variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : '',
    variant === 'ghost' ? 'bg-transparent hover:bg-gray-100' : '',
    { 'opacity-50 cursor-not-allowed': disabled }
  ]">
    <slot />
  </button>
</template>
```

## Tailwind Config

Keep customizations minimal. Extend, don't override:

```js
// tailwind.config.js
export default {
  content: [
    // Adjust per framework
    './src/**/*.{vue,js,ts,jsx,tsx}',    // Vue/Nuxt
    './app/**/*.{js,ts,jsx,tsx,mdx}',    // Next.js App Router
    './pages/**/*.{js,ts,jsx,tsx,mdx}',  // Next.js Pages
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ✅ Extend existing values
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // ❌ Don't override entire keys at theme root level
    },
  },
  plugins: [],
}
```

## Avoid These Patterns

- Never use `style=""` when a Tailwind class exists
- Never mix Tailwind with separate CSS files for the same component
- Never hardcode pixel values (`w-[347px]`) — use design tokens or closest utility
- Avoid `!important` via `!` prefix unless overriding third-party styles
- Don't create utility classes that duplicate Tailwind's API
- Keep arbitrary values (`text-[#1a1a2e]`) to a minimum — define in config instead

## Spacing and Sizing Consistency

Use the default scale. Pick one spacing rhythm and stay consistent:

```
Tight:  gap-1, gap-2, p-2, p-3  (compact UIs, dashboards)
Normal: gap-2, gap-4, p-4, p-6  (most applications)
Loose:  gap-4, gap-8, p-6, p-8  (marketing, landing pages)
```

## Animation and Transitions

Prefer Tailwind's built-in transitions. Use CSS animations only for complex sequences.

```html
<!-- ✅ Simple transitions -->
<button class="transition-colors duration-200 hover:bg-blue-700">
<div class="transition-all duration-300 ease-in-out">

<!-- ✅ Built-in animations -->
<div class="animate-spin">Loading...</div>
<div class="animate-pulse">Skeleton</div>
```