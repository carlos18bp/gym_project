# Unified Architecture
## Backend Django REST + Frontend Vue 3

**Development Standards and Patterns Guide**

This document consolidates and standardizes architecture best practices for fullstack projects, unifying three reference templates into a single corporate standard.

**Version 1.0 - January 2026**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend - Django REST Framework](#2-backend---django-rest-framework)
   - 2.1 [Standard Folder Structure](#21-standard-folder-structure)
   - 2.2 [Configuration (settings.py)](#22-configuration-settingspy)
   - 2.3 [Domain Models](#23-domain-models)
   - 2.4 [Serializers](#24-serializers)
   - 2.5 [API Views (@api_view)](#25-api-views-api_view)
   - 2.6 [URLs by Module](#26-urls-by-module)
   - 2.7 [Custom Django Admin](#27-custom-django-admin)
   - 2.8 [Management Commands (Fake Data)](#28-management-commands-fake-data)
   - 2.9 [Services and Integrations](#29-services-and-integrations)
   - 2.10 [Documentation Conventions](#210-documentation-conventions)
   - 2.11 [Image Gallery (django_attachments)](#211-image-gallery-django_attachments)
   - 2.12 [Testing (Backend)](#212-testing-backend)
3. [Frontend - Vue 3 + Vite + Pinia](#3-frontend---vue-3--vite--pinia)
   - 3.1 [Folder Structure](#31-folder-structure)
   - 3.2 [Configuration (main.js)](#32-configuration-mainjs)
   - 3.3 [HTTP Service (Axios + JWT)](#33-http-service-axios--jwt)
   - 3.4 [Pinia Stores (CRUD)](#34-pinia-stores-crud)
   - 3.5 [Router and Guards](#35-router-and-guards)
   - 3.6 [Internationalization (i18n)](#36-internationalization-i18n)
   - 3.7 [Testing (Frontend)](#37-testing-frontend)
4. [Standard Dependencies](#4-standard-dependencies)
5. [Execution Commands](#5-execution-commands)
6. [New Project Checklist](#6-new-project-checklist)

---

## 1. Architecture Overview

This architecture defines the standard for fullstack projects that combine a robust backend with Django REST Framework and a modern frontend with Vue 3. The goal is to maximize code reuse, maintain consistency across projects, and facilitate onboarding of new developers.

### 1.1 Technology Stack

| Layer | Technology | Purpose |
|------|------------|-----------|
| Backend | Django 4.x + DRF | API REST, ORM, Admin |
| Authentication | SimpleJWT | Tokens JWT with refresh |
| Database | MySQL | Data persistence |
| Cache | Redis (optional) | Sessions, query cache |
| Frontend | Vue 3 + Vite | SPA with Composition API |
| State | Pinia + Persistence | Reactive stores |
| Routing | Vue Router 4 | SPA navigation |
| HTTP Client | Axios | API requests |
| Styles | TailwindCSS | CSS utilities |
| i18n | Vue I18n | Multi-language |

### 1.2 Design Principles

- **Separation of concerns:** Models, Serializers, Views, URLs clearly separated.
- **Modularity:** Each domain in its own module (separate files).
- **Reusability:** HTTP services, stores, and generic components.
- **Consistency:** Same API response patterns and store structure.
- **Security:** JWT by default, CORS configured, credentials in environment variables.
- **English documentation:** All code comments must be in English and use DocStrings.

---

## 2. Backend - Django REST Framework

### 2.1 Standard Folder Structure

```
backend/
├── core_project/           # Django project
│   ├── settings.py         # Global configuration
│   ├── urls.py             # Root URLs
│   ├── wsgi.py / asgi.py   # Entry points
├── core_app/               # Main domain app
│   ├── models/             # Models per entity
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── product.py
│   │   └── order.py
│   ├── serializers/        # Serializers per module
│   │   ├── __init__.py
│   │   ├── user_serializers.py
│   │   └── product_serializers.py
│   ├── views/              # API views per module
│   │   ├── __init__.py
│   │   ├── auth_views.py
│   │   └── product_views.py
│   ├── urls/               # URLs per module
│   │   ├── __init__.py
│   │   ├── auth_urls.py
│   │   └── product_urls.py
│   ├── services/           # Business logic
│   │   ├── email_service.py
│   │   └── payment_service.py
│   ├── middleware/         # Custom middleware
│   ├── management/commands/# Django commands
│   │   ├── create_fake_data.py
│   │   └── delete_fake_data.py
│   ├── admin.py            # Admin configuration
│   └── utils/              # Shared helpers
├── django_attachments/     # Gallery subproject (optional)
├── media/                  # Uploaded files
├── static/                 # Static files
└── requirements.txt
```

> **Note:** Each model, serializer, view, and URL must be in its own file within the corresponding directory. This facilitates maintenance and avoids monolithic files that are difficult to navigate.

---

### 2.2 Configuration (settings.py)

#### 2.2.1 Installed Apps

```python
INSTALLED_APPS = [
    # Django Core
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party (required)
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    
    # Third-party (optional per project)
    'django_redis',
    'easy_thumbnails',
    'django_cleanup.apps.CleanupConfig',
    
    # Project app
    'core_app',
]
```

#### 2.2.2 REST Framework Configuration

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
```

#### 2.2.3 JWT Configuration

```python
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),    # Adjust based on security requirements
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

#### 2.2.4 CORS and Security

```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',      # Vite dev server
    'http://127.0.0.1:5173',
    # Add production domains
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'origin', 'x-csrftoken', 'x-requested-with',
    'x-currency', 'accept-language',  # Custom headers
]

# Custom user model (REQUIRED from the start)
AUTH_USER_MODEL = 'core_app.User'
```

> **Important:** Credentials (SECRET_KEY, DB passwords, API keys) must NEVER be hardcoded. Use environment variables with `os.getenv()`.

---

### 2.3 Domain Models

Models represent domain entities. Each model goes in its own file inside `models/`. Use computed properties for derived logic.

```python
# core_app/models/product.py
import os
from django.db import models


class Product(models.Model):
    """
    Product model representing items available for sale.
    
    Attributes:
        name_en: Product name in English.
        name_es: Product name in Spanish.
        price: Product price in default currency.
        stock: Available quantity in inventory.
        is_active: Whether the product is visible to customers.
    """
    
    # Bilingual fields (standard pattern)
    name_en = models.CharField(max_length=255)
    name_es = models.CharField(max_length=255)
    description_en = models.TextField(blank=True)
    description_es = models.TextField(blank=True)
    
    # Business fields
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    # File fields
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    
    # Timestamps (always include)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name_en
    
    @property
    def is_in_stock(self):
        """Check if product has available inventory."""
        return self.stock > 0
    
    def delete(self, *args, **kwargs):
        """Override delete to clean up associated files."""
        if self.image and os.path.isfile(self.image.path):
            os.remove(self.image.path)
        super().delete(*args, **kwargs)
```

---

### 2.4 Serializers

Create specific serializers per use case: List (lightweight), Detail (complete), CreateUpdate (with validations). This optimizes performance and clarifies the API.

```python
# core_app/serializers/product_serializers.py
from rest_framework import serializers
from ..models import Product


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for product listings."""
    
    class Meta:
        model = Product
        fields = ['id', 'name_en', 'name_es', 'price', 'is_in_stock', 'image']


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full serializer for product detail view."""
    is_in_stock = serializers.ReadOnlyField()
    
    class Meta:
        model = Product
        fields = '__all__'


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for create/update operations with validations."""
    
    class Meta:
        model = Product
        fields = ['name_en', 'name_es', 'description_en', 'description_es',
                  'price', 'stock', 'is_active', 'image']
    
    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Price must be greater than 0')
        return value
```

---

### 2.5 API Views (@api_view)

The standard uses function-based views with `@api_view`. Each endpoint has its own function with explicit permissions. Responses follow a consistent format with descriptive keys.

```python
# core_app/views/product_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from ..models import Product
from ..serializers.product_serializers import (
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateUpdateSerializer,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_products(request):
    """Return all active products."""
    products = Product.objects.filter(is_active=True)
    serializer = ProductListSerializer(products, many=True, context={'request': request})
    return Response({'products': serializer.data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def retrieve_product(request, product_id):
    """Get product detail by ID."""
    try:
        product = Product.objects.get(id=product_id, is_active=True)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = ProductDetailSerializer(product, context={'request': request})
    return Response({'product': serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_product(request):
    """Create a new product (admin only)."""
    serializer = ProductCreateUpdateSerializer(data=request.data)
    if serializer.is_valid():
        product = serializer.save()
        return Response({
            'message': 'Product created successfully',
            'product': ProductDetailSerializer(product).data
        }, status=status.HTTP_201_CREATED)
    return Response({'error': 'Invalid data', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAdminUser])
def update_product(request, product_id):
    """Update an existing product."""
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
    
    partial = request.method == 'PATCH'
    serializer = ProductCreateUpdateSerializer(product, data=request.data, partial=partial)
    if serializer.is_valid():
        product = serializer.save()
        return Response({
            'message': 'Product updated successfully',
            'product': ProductDetailSerializer(product).data
        }, status=status.HTTP_200_OK)
    return Response({'error': 'Invalid data', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def delete_product(request, product_id):
    """Delete a product."""
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
    
    product.delete()
    return Response({'message': 'Product deleted successfully'}, status=status.HTTP_200_OK)
```

---

### 2.6 URLs by Module

URLs are organized by functional module. Each module has its own URL file that is included in the main urlpatterns.

```python
# core_app/urls/product_urls.py
from django.urls import path
from ..views.product_views import (
    list_products, retrieve_product, create_product, update_product, delete_product
)

urlpatterns = [
    path('', list_products, name='list-products'),
    path('<int:product_id>/', retrieve_product, name='retrieve-product'),
    path('create/', create_product, name='create-product'),
    path('<int:product_id>/update/', update_product, name='update-product'),
    path('<int:product_id>/delete/', delete_product, name='delete-product'),
]
```

```python
# core_project/urls.py
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core_app.urls.auth_urls')),
    path('api/products/', include('core_app.urls.product_urls')),
    path('api/orders/', include('core_app.urls.order_urls')),
    # ... more modules
]
```

#### Endpoint Convention

| Action | Method | URL | Name |
|--------|--------|-----|------|
| List | GET | /api/entities/ | list-entities |
| Detail | GET | /api/entities/{id}/ | retrieve-entity |
| Create | POST | /api/entities/create/ | create-entity |
| Update | PUT/PATCH | /api/entities/{id}/update/ | update-entity |
| Delete | DELETE | /api/entities/{id}/delete/ | delete-entity |

---

### 2.7 Custom Django Admin

Configure an explicit ModelAdmin for each model with `list_display`, `search_fields`, `list_filter`, etc. For large projects, create a custom AdminSite.

```python
# core_app/admin.py
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Product, Order, User


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name_en', 'price', 'stock', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name_en', 'name_es', 'description_en')
    readonly_fields = ('created_at', 'updated_at')
    list_editable = ('is_active', 'stock')
    ordering = ('-created_at',)


# Custom AdminSite (for large projects)
class ProjectAdminSite(admin.AdminSite):
    site_header = 'Admin Panel'
    site_title = 'Admin'
    index_title = 'Control Panel'
    
    def get_app_list(self, request):
        app_dict = self._build_app_dict(request)
        # Organize by logical sections
        return [
            {'name': _('Users'), 'models': [...]},
            {'name': _('Products'), 'models': [...]},
            {'name': _('Orders'), 'models': [...]},
        ]

admin_site = ProjectAdminSite(name='project_admin')
```

---

### 2.8 Management Commands (Fake Data)

Management commands allow populating and cleaning test data in a controlled manner. **ONE SEPARATE FILE per entity/model** must be created, following the single responsibility principle.

> **IMPORTANT RULE:** Each model must have its own command file to generate fake data. This allows running individual commands during development and facilitates maintenance.

> **PROJECT STANDARD:** If a command currently creates multiple models (e.g., `clients + lawyers` in a single file), it should be refactored so each model has its own independent file (e.g., `users`, `organizations`, `processes`, etc.). The `create_fake_data.py` command should be limited to **orchestrating** (calling in order) those generators.

#### 2.8.1 Command File Structure

```
core_app/
└── management/
    └── commands/
        ├── create_fake_data.py        # Master command (orchestrator)
        ├── delete_fake_data.py        # Data cleanup
        ├── create_fake_users.py       # User (this model only + minimal dependencies)
        ├── create_fake_categories.py  # Categories (no dependencies)
        ├── create_fake_products.py    # Product (this model only, depends on Category)
        ├── create_fake_carts.py       # Carts (depends on User, Product)
        ├── create_fake_orders.py      # Orders (depends on User, Product)
        └── create_fake_reviews.py     # Reviews (depends on User, Product)
```

#### 2.8.2 Master Command (Orchestrator)

```python
# core_app/management/commands/create_fake_data.py
"""
Master command to orchestrate fake data creation for the entire system.

This command calls individual entity commands in the correct order,
respecting model dependencies (e.g., Products need Categories first).
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create fake data for all entities in the correct order'
    
    def add_arguments(self, parser):
        parser.add_argument('--users', type=int, default=20,
                           help='Number of users to create')
        parser.add_argument('--categories', type=int, default=10,
                           help='Number of categories to create')
        parser.add_argument('--products', type=int, default=50,
                           help='Number of products to create')
        parser.add_argument('--orders', type=int, default=30,
                           help='Number of orders to create')
        parser.add_argument('--reviews', type=int, default=100,
                           help='Number of reviews to create')
    
    def handle(self, *args, **options):
        self.stdout.write('🚀 Starting fake data creation...\n')
        
        # Order matters! Respect dependencies
        # 1. Independent entities first
        self.stdout.write('Creating users...')
        call_command('create_fake_users', '--num', options['users'])
        
        self.stdout.write('Creating categories...')
        call_command('create_fake_categories', '--num', options['categories'])
        
        # 2. Entities with single dependency
        self.stdout.write('Creating products...')
        call_command('create_fake_products', '--num', options['products'])
        
        # 3. Entities with multiple dependencies
        self.stdout.write('Creating orders...')
        call_command('create_fake_orders', '--num', options['orders'])
        
        self.stdout.write('Creating reviews...')
        call_command('create_fake_reviews', '--num', options['reviews'])
        
        self.stdout.write(self.style.SUCCESS('\n✅ Fake data created successfully!'))
```

#### 2.8.3 Per-Entity Command - Complete Example (Products)

```python
# core_app/management/commands/create_fake_products.py
"""
Command to generate fake product data for development and testing.

This command creates realistic product records with:
- Bilingual content (English/Spanish)
- Random pricing and stock levels
- Association with existing categories
- Placeholder images

Dependencies:
    - Category model must have existing records
    
Usage:
    python manage.py create_fake_products --num 50
    python manage.py create_fake_products --num 100 --with-images
"""
import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from faker import Faker

from core_app.models import Product, Category


class Command(BaseCommand):
    help = 'Create fake products with realistic data'
    
    def __init__(self):
        super().__init__()
        self.fake_en = Faker('en_US')
        self.fake_es = Faker('es_ES')
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--num',
            type=int,
            default=50,
            help='Number of products to create (default: 50)'
        )
        parser.add_argument(
            '--with-images',
            action='store_true',
            help='Generate placeholder images for products'
        )
    
    def handle(self, *args, **options):
        num_products = options['num']
        with_images = options['with_images']
        
        # Validate dependencies exist
        categories = list(Category.objects.all())
        if not categories:
            self.stdout.write(self.style.ERROR(
                'No categories found. Run create_fake_categories first.'
            ))
            return
        
        self.stdout.write(f'Creating {num_products} fake products...')
        
        created_count = 0
        for i in range(num_products):
            product = self._create_product(categories, with_images)
            if product:
                created_count += 1
                if created_count % 10 == 0:
                    self.stdout.write(f'  Created {created_count} products...')
        
        self.stdout.write(self.style.SUCCESS(
            f'✅ Successfully created {created_count} products'
        ))
    
    def _create_product(self, categories, with_images=False):
        """
        Create a single product with randomized data.
        
        Args:
            categories: List of available Category instances.
            with_images: Whether to generate placeholder images.
        
        Returns:
            Product: The created product instance.
        """
        # Generate bilingual product name
        product_type = random.choice([
            'Laptop', 'Phone', 'Tablet', 'Headphones', 'Camera',
            'Watch', 'Speaker', 'Monitor', 'Keyboard', 'Mouse'
        ])
        brand = self.fake_en.company()
        
        name_en = f'{brand} {product_type} {self.fake_en.word().title()}'
        name_es = f'{product_type} {brand} {self.fake_es.word().title()}'
        
        # Generate descriptions
        desc_en = self.fake_en.paragraph(nb_sentences=3)
        desc_es = self.fake_es.paragraph(nb_sentences=3)
        
        # Generate realistic pricing
        base_price = random.choice([29.99, 49.99, 99.99, 149.99, 299.99, 499.99])
        price = Decimal(str(base_price)) + Decimal(random.randint(0, 50))
        
        # Create product
        product = Product.objects.create(
            name_en=name_en,
            name_es=name_es,
            description_en=desc_en,
            description_es=desc_es,
            price=price,
            stock=random.randint(0, 100),
            is_active=random.random() > 0.1,  # 90% active
            category=random.choice(categories),
        )
        
        return product
```

#### 2.8.4 Cleanup Command (Delete)

```python
# core_app/management/commands/delete_fake_data.py
"""
Command to safely delete all fake/test data from the database.

IMPORTANT: This command respects the reverse order of dependencies
to avoid foreign key constraint violations.

Protected records (not deleted):
- Superusers
- Users with specific protected emails
- System configuration records
"""
from django.core.management.base import BaseCommand

from core_app.models import (
    User, Category, Product, Order, OrderItem, Review, Cart, CartItem
)


class Command(BaseCommand):
    help = 'Delete all fake data (requires --confirm flag)'
    
    # Emails that should never be deleted
    PROTECTED_EMAILS = {
        'admin@example.com',
        'superadmin@company.com',
    }
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Required flag to confirm deletion'
        )
    
    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(self.style.WARNING(
                '⚠️  This will DELETE ALL test data!\n'
                'Run with --confirm to proceed:\n'
                '  python manage.py delete_fake_data --confirm'
            ))
            return
        
        self.stdout.write('🗑️  Deleting fake data...\n')
        
        # Delete in reverse dependency order
        # 1. Entities with most dependencies first
        self._delete_model(OrderItem, 'order items')
        self._delete_model(Order, 'orders')
        self._delete_model(CartItem, 'cart items')
        self._delete_model(Cart, 'carts')
        self._delete_model(Review, 'reviews')
        
        # 2. Entities with single dependency
        self._delete_model(Product, 'products')
        
        # 3. Independent entities
        self._delete_model(Category, 'categories')
        
        # 4. Users (with protection)
        deleted_users = User.objects.exclude(
            email__in=self.PROTECTED_EMAILS
        ).exclude(
            is_superuser=True
        ).delete()
        self.stdout.write(f'  Deleted {deleted_users[0]} users')
        
        self.stdout.write(self.style.SUCCESS('\n✅ All fake data deleted'))
    
    def _delete_model(self, model, name):
        """Helper to delete all records of a model."""
        count = model.objects.count()
        model.objects.all().delete()
        self.stdout.write(f'  Deleted {count} {name}')
```

#### 2.8.5 Dependency Diagram

```
Creation Order (from least to most dependencies):
═══════════════════════════════════════════════

    [User] ─────────────────────┐
                                │
    [Category] ──────┐          │
                     │          │
                     ▼          │
               [Product] ◄──────┤
                     │          │
                     ▼          ▼
               [Review] ◄── [User]
                     
               [Order] ◄─── [User]
                  │
                  ▼
            [OrderItem] ◄── [Product]


Deletion Order (reverse - from most to least dependencies):
═════════════════════════════════════════════════════════════

    1. OrderItem  (depends on Order, Product)
    2. Order      (depends on User)
    3. Review     (depends on User, Product)
    4. CartItem   (depends on Cart, Product)
    5. Cart       (depends on User)
    6. Product    (depends on Category)
    7. Category   (independent)
    8. User       (independent, protect admins)
```

---

### 2.9 Services and Integrations

Complex business logic and external integrations go in `services/`. This keeps views clean and facilitates unit testing.

```python
# core_app/services/email_service.py
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string


class EmailService:
    """
    Service class for handling email notifications.
    
    Provides static methods for sending various types of emails
    using Django's email backend with HTML templates.
    """
    
    @staticmethod
    def send_welcome_email(user):
        """
        Send a welcome email to a newly registered user.
        
        Args:
            user: User instance with email attribute.
        
        Returns:
            int: Number of successfully delivered messages (0 or 1).
        """
        subject = 'Welcome to our platform'
        html_message = render_to_string('emails/welcome.html', {'user': user})
        
        return send_mail(
            subject=subject,
            message='',  # Plain text fallback
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    
    @staticmethod
    def send_order_confirmation(order):
        """
        Send order confirmation email to customer.
        
        Args:
            order: Order instance with customer and items data.
        """
        # Implementation follows same pattern...
        pass

# Usage in views:
# from ..services.email_service import EmailService
# EmailService.send_welcome_email(user)
```

---

### 2.10 Documentation Conventions

> **MANDATORY RULE:** All comments and documentation within the code must be written in ENGLISH and must use the Python DocString format. This convention applies to both backend (Python/Django) and frontend (JavaScript/Vue).

#### 2.10.1 Python DocStrings (Backend)

```python
# CORRECT - English DocString
class OrderService:
    """
    Service class for handling order operations.
    
    This service manages order creation, updates, and integrations
    with external payment providers.
    
    Attributes:
        payment_gateway: Instance of the payment provider client.
        notification_service: Service for sending order notifications.
    
    Example:
        >>> service = OrderService()
        >>> order = service.create_order(user_id=1, items=[...])
    """
    
    def calculate_total(self, items):
        """
        Calculate the total price for a list of order items.
        
        Args:
            items: List of OrderItem objects with price and quantity.
        
        Returns:
            Decimal: The total price including taxes.
        
        Raises:
            ValueError: If items list is empty.
        """
        if not items:
            raise ValueError("Items list cannot be empty")
        return sum(item.price * item.quantity for item in items)


# INCORRECT - Spanish comments
class ServicioOrdenes:  # NO: Spanish name
    # Este servicio maneja las órdenes  # NO: Spanish comment
    def calcular_total(self, items):
        # Calcular el total  # NO
        pass
```

#### 2.10.2 JavaScript/Vue Comments (Frontend)

```javascript
// CORRECT - English JSDoc
/**
 * Fetches products from the API with optional filters.
 * 
 * @param {Object} filters - Filter options for the query
 * @param {string} filters.category - Product category to filter by
 * @param {number} filters.minPrice - Minimum price threshold
 * @param {number} filters.maxPrice - Maximum price threshold
 * @returns {Promise<Array>} Array of product objects
 * @throws {Error} If the API request fails
 * 
 * @example
 * const products = await fetchProducts({ category: 'electronics' });
 */
async function fetchProducts(filters = {}) {
    // Build query parameters from filters
    const params = new URLSearchParams(filters);
    
    // Make API request
    const response = await get_request(`products/?${params}`);
    
    // Return parsed data
    return response.data.products;
}

// INCORRECT
async function obtenerProductos(filtros) {  // NO: Spanish name
    // Obtener los productos del servidor  // NO: Spanish comment
    const respuesta = await get_request('products/');
    return respuesta.data;
}
```

#### 2.10.3 Convention Summary

- **Language:** Everything in ENGLISH (comments, DocStrings, variable names, functions, and classes).
- **Python format:** Use DocStrings with triple quotes. Include description, Args, Returns, Raises.
- **JavaScript format:** Use JSDoc with `/** */`. Include @param, @returns, @throws, @example.
- **Classes:** Document purpose, main attributes, and usage example.
- **Functions:** Document what it does, parameters, return value, and exceptions.
- **Complex code:** Add inline comments explaining non-obvious logic.
- **TODO/FIXME:** Use standard format: `// TODO: description` or `# TODO: description`.

---

### 2.11 Image Gallery (django_attachments)

This library is an **ESSENTIAL** component of our architecture for managing image galleries on any model. It provides reusable fields (GalleryField, LibraryField), widgets for Django admin, and a unified experience for uploading, sorting, and deleting images.

> **Repository:** https://github.com/carlos18bp/django-attachments
> 
> **Based on:** Fork of mireq/django-attachments with custom improvements.

#### 2.11.1 Installation and Configuration

The library is included as a vendored subproject inside the backend. This allows full control over modifications.

```
backend/
├── django_attachments/      # Subproject copied from repo
│   ├── __init__.py
│   ├── admin.py             # AttachmentsAdminMixin, widgets
│   ├── fields.py            # GalleryField, LibraryField
│   ├── models.py            # Library, Attachment
│   ├── migrations/
│   ├── static/
│   │   └── django_attachments/
│   │       ├── css/
│   │       └── js/
│   └── templates/
│       └── django_attachments/
├── core_app/
└── core_project/
```

**Configuration in settings.py:**

```python
# core_project/settings.py

INSTALLED_APPS = [
    # Django core...
    
    # Image management dependencies (install before django_attachments)
    'easy_thumbnails',                    # Thumbnail generation
    'django_cleanup.apps.CleanupConfig',  # Auto-cleanup orphan files
    
    # Gallery/Attachments subproject
    'django_attachments',
    
    # Main app
    'core_app',
]

# Thumbnail configuration (required for django_attachments)
THUMBNAIL_ALIASES = {
    '': {
        'small':  {'size': (50, 50),   'crop': True},
        'medium': {'size': (200, 200), 'crop': True},
        'large':  {'size': (500, 500), 'crop': False},
        'admin':  {'size': (100, 100), 'crop': True},
    },
}

# Media files configuration
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

**After configuration, run migrations:**

```bash
python manage.py makemigrations
python manage.py migrate django_attachments
python manage.py migrate
```

#### 2.11.2 Usage in Models

Models that need image galleries use `GalleryField` (for multiple images) or `LibraryField` (for general attachments). It is **CRITICAL** to implement the `delete()` method to clean up associated galleries.

```python
# core_app/models/product.py
"""
Product model with image gallery support.

Uses django_attachments for managing product images with
automatic cleanup on deletion.
"""
from django.db import models
from django_attachments.fields import GalleryField
from django_attachments.models import Library


class Product(models.Model):
    """
    Product entity with gallery support.
    
    Attributes:
        name_en: Product name in English.
        name_es: Product name in Spanish.
        price: Product price.
        gallery: Image gallery (managed by django_attachments).
    """
    
    # Business fields
    name_en = models.CharField(max_length=255)
    name_es = models.CharField(max_length=255)
    description_en = models.TextField(blank=True)
    description_es = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    # Gallery field - stores multiple images
    gallery = GalleryField(
        related_name='products_with_gallery',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name_en
    
    def delete(self, *args, **kwargs):
        """
        Override delete to clean up associated gallery.
        
        IMPORTANT: This prevents orphan files in the media directory.
        Always implement this pattern for models with GalleryField.
        """
        try:
            if self.gallery:
                self.gallery.delete()
        except Library.DoesNotExist:
            pass
        super().delete(*args, **kwargs)
```

**Example with multiple galleries (Home/Landing page):**

```python
# core_app/models/home.py
"""Home page model with multiple gallery sections."""
from django.db import models
from django_attachments.fields import GalleryField
from django_attachments.models import Library


class Home(models.Model):
    """
    Home page configuration with multiple image galleries.
    
    Typically only one instance exists (singleton pattern).
    """
    
    # Hero section
    hero_title_en = models.CharField(max_length=255)
    hero_title_es = models.CharField(max_length=255)
    
    # Multiple galleries for different sections
    carousel_gallery = GalleryField(
        related_name='home_carousel',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    featured_gallery = GalleryField(
        related_name='home_featured',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    testimonials_gallery = GalleryField(
        related_name='home_testimonials',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    def delete(self, *args, **kwargs):
        """Clean up ALL associated galleries."""
        galleries = [
            self.carousel_gallery,
            self.featured_gallery,
            self.testimonials_gallery
        ]
        for gallery in galleries:
            try:
                if gallery:
                    gallery.delete()
            except Library.DoesNotExist:
                pass
        super().delete(*args, **kwargs)
```

#### 2.11.3 Admin Forms

For the admin to correctly display gallery widgets, create ModelForms that automatically initialize Library objects.

```python
# core_app/forms.py
"""
Model forms with automatic Library initialization for gallery fields.

These forms ensure that GalleryField widgets work correctly in Django Admin
by creating Library instances when they don't exist.
"""
from django import forms
from django_attachments.models import Library
from .models import Product, Home


class ProductForm(forms.ModelForm):
    """
    Form for Product model with gallery support.
    
    Automatically creates a Library instance for the gallery field
    if one doesn't exist.
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make gallery field optional in the form
        self.fields['gallery'].required = False
    
    def save(self, commit=True):
        """
        Save the product, creating a Library if needed.
        
        Args:
            commit: Whether to save to database immediately.
        
        Returns:
            Product: The saved product instance.
        """
        obj = super().save(commit=False)
        
        # Create Library if it doesn't exist
        if not obj.gallery_id:
            library = Library()
            library.save()
            obj.gallery = library
        
        if commit:
            obj.save()
        return obj
    
    class Meta:
        model = Product
        fields = '__all__'


class HomeForm(forms.ModelForm):
    """Form for Home model with multiple gallery fields."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # All gallery fields are optional
        gallery_fields = [
            'carousel_gallery',
            'featured_gallery',
            'testimonials_gallery'
        ]
        for field_name in gallery_fields:
            if field_name in self.fields:
                self.fields[field_name].required = False
    
    def save(self, commit=True):
        """Save the home instance, creating Libraries for all galleries."""
        obj = super().save(commit=False)
        
        gallery_fields = [
            'carousel_gallery',
            'featured_gallery',
            'testimonials_gallery'
        ]
        
        for field_name in gallery_fields:
            field_id = f'{field_name}_id'
            if not getattr(obj, field_id, None):
                library = Library()
                library.save()
                setattr(obj, field_name, library)
        
        if commit:
            obj.save()
        return obj
    
    class Meta:
        model = Home
        fields = '__all__'
```

#### 2.11.4 Admin Configuration

The ModelAdmin must inherit from `AttachmentsAdminMixin` and override `delete_queryset` to ensure gallery cleanup.

```python
# core_app/admin.py
"""
Django Admin configuration with gallery support.

Uses AttachmentsAdminMixin to enable image gallery widgets
and custom delete handling to clean up associated files.
"""
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django_attachments.admin import AttachmentsAdminMixin

from .models import Product, Home, Category
from .forms import ProductForm, HomeForm


class ProductAdmin(AttachmentsAdminMixin, admin.ModelAdmin):
    """
    Admin for Product model with gallery support.
    
    AttachmentsAdminMixin provides:
    - Custom widgets for GalleryField (drag & drop, ordering)
    - AJAX upload functionality
    - Thumbnail previews
    """
    form = ProductForm
    
    list_display = ('name_en', 'price', 'stock', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name_en', 'name_es', 'description_en')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        (None, {
            'fields': ('name_en', 'name_es', 'price', 'stock', 'is_active')
        }),
        (_('Descriptions'), {
            'fields': ('description_en', 'description_es'),
            'classes': ('collapse',)
        }),
        (_('Gallery'), {
            'fields': ('gallery',),
            'description': _('Drag and drop images to reorder. Click to edit.')
        }),
        (_('Metadata'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def delete_queryset(self, request, queryset):
        """
        Override bulk delete to use model's delete() method.
        
        IMPORTANT: The default queryset.delete() bypasses the model's
        delete() method, which would leave orphan gallery files.
        """
        for obj in queryset:
            obj.delete()


class HomeAdmin(AttachmentsAdminMixin, admin.ModelAdmin):
    """Admin for Home model with multiple galleries."""
    form = HomeForm
    
    def delete_queryset(self, request, queryset):
        """Use model's delete() to clean up all galleries."""
        for obj in queryset:
            obj.delete()


# Register models
admin.site.register(Product, ProductAdmin)
admin.site.register(Home, HomeAdmin)
admin.site.register(Category)
```

#### 2.11.5 API Serializers

To expose images in the REST API, use `SerializerMethodField` to extract URLs.

```python
# core_app/serializers/product_serializers.py
"""
Product serializers with gallery URL extraction.
"""
from rest_framework import serializers
from ..models import Product


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer with thumbnail only."""
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ['id', 'name_en', 'name_es', 'price', 'stock', 'thumbnail_url']
    
    def get_thumbnail_url(self, obj):
        """Get the first image URL from the gallery."""
        request = self.context.get('request')
        if not request or not obj.gallery:
            return None
        
        first_attachment = obj.gallery.attachment_set.order_by('rank').first()
        if first_attachment and first_attachment.file:
            return request.build_absolute_uri(first_attachment.file.url)
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full serializer with all gallery images."""
    gallery_images = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = '__all__'
    
    def get_gallery_images(self, obj):
        """Get all images from the gallery with metadata."""
        request = self.context.get('request')
        if not request or not obj.gallery:
            return []
        
        images = []
        for attachment in obj.gallery.attachment_set.order_by('rank'):
            if attachment.file:
                images.append({
                    'id': attachment.id,
                    'url': request.build_absolute_uri(attachment.file.url),
                    'original_name': attachment.original_name,
                    'title': attachment.title or '',
                    'caption': attachment.caption or '',
                    'width': attachment.image_width,
                    'height': attachment.image_height,
                    'filesize': attachment.filesize,
                    'rank': attachment.rank,
                })
        return images
```

#### django_attachments Integration Summary

- **Installation:** Check if `backend/django_attachments/` exists. If not, clone the repository inside `backend/` then add to `INSTALLED_APPS` and run migrations.
- **Dependencies:** Requires easy_thumbnails and django_cleanup.
- **Models:** Use GalleryField, ALWAYS implement delete() to clean up galleries.
- **Forms:** Create ModelForm that automatically initializes Library.
- **Admin:** Inherit from AttachmentsAdminMixin, override delete_queryset.
- **Serializers:** Use SerializerMethodField to extract image URLs.
- **URLs:** No manual configuration required - admin registers them automatically.

Official repository (for cloning):

```
https://github.com/carlos18bp/django-attachments.git
```

Suggested command (clone inside `backend/`):

```bash
git clone https://github.com/carlos18bp/django-attachments.git backend/django_attachments
```

---

### 2.12 Testing (Backend)

#### 2.12.1 Test Types in the Project

In the backend, tests are organized as a `pytest` package inside the Django app:

```
backend/
└── gym_app/
    └── tests/
        ├── models/        # Unit tests for models (validations, managers, constraints)
        ├── serializers/   # Unit tests for DRF serializers
        ├── views/         # Endpoint tests (lightweight integration with DRF APIClient)
        ├── tasks/         # Task tests (Celery / jobs)
        └── utils/         # Unit tests for utilities
```

Practical classification:

- **Unit tests**
  - Models (`gym_app/tests/models/*`)
  - Serializers (`gym_app/tests/serializers/*`)
  - Utils (`gym_app/tests/utils/*`)
- **Flow / lightweight integration (API)**
  - Views (`gym_app/tests/views/*`) using `rest_framework.test.APIClient`, `reverse()` and asserts on status/response.

#### 2.12.2 Libraries Used

- **pytest**
- **pytest-django**
- **pytest-cov / coverage** (for coverage)
- **Django REST Framework test utilities** (`APIClient`)
- **unittest.mock** (`patch`, `MagicMock`) for mocks on external integrations (email, requests, etc.)

#### 2.12.3 Conventions and Patterns

- Use `@pytest.mark.django_db` on tests that touch the database.
- Prefer `@pytest.fixture` fixtures for reusable data.
- In endpoint tests:
  - Authenticate with `api_client.force_authenticate(user=...)`.
  - Resolve URLs with `reverse('<url_name>')`.
  - Validate `status_code` and payload shape.

#### 2.12.4 Real Example (Endpoint Test)

Representative example (taken from the project):

```python
@pytest.mark.django_db
def test_sign_in_with_password_success(api_client, existing_user, mock_requests_post):
    url = reverse('sign_in')
    response = api_client.post(url, {
        'email': existing_user.email,
        'password': 'existingpassword',
        'captcha_token': 'valid_captcha_token',
    }, format='json')
    assert response.status_code == status.HTTP_200_OK
```

#### 2.12.5 How to Run Tests

No versioned `pytest.ini` was found. In environments where `pytest-django` does not automatically detect settings, it is recommended to configure:

- Environment variable: `DJANGO_SETTINGS_MODULE=gym_project.settings`

Recommended commands (from `backend/`):

```bash
pytest
pytest -q
pytest --cov
```

---

## 3. Frontend - Vue 3 + Vite + Pinia

### 3.1 Folder Structure

```
frontend/
├── src/
│   ├── main.js              # App bootstrap
│   ├── App.vue              # Root component
│   ├── style.css            # Global styles + Tailwind
│   │
│   ├── router/
│   │   └── index.js         # Route configuration and guards
│   │
│   ├── stores/
│   │   ├── index.js         # Export all stores
│   │   ├── services/
│   │   │   └── request_http.js  # HTTP client (Axios)
│   │   └── modules/
│   │       ├── authStore.js
│   │       ├── productStore.js
│   │       ├── i18nStore.js
│   │       └── currencyStore.js
│   │
│   ├── views/               # Pages/Views
│   │   ├── auth/
│   │   │   ├── LoginView.vue
│   │   │   └── RegisterView.vue
│   │   ├── products/
│   │   │   ├── ProductListView.vue
│   │   │   └── ProductDetailView.vue
│   │   └── ...
│   │
│   ├── components/          # Reusable components
│   │   ├── common/
│   │   ├── forms/
│   │   └── layouts/
│   │
│   ├── composables/         # Reusable logic (hooks)
│   │
│   ├── locales/             # Translation files
│   │   ├── en.json
│   │   └── es.json
│   │
│   └── utils/               # Helpers and utilities
│
├── public/
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

### 3.2 Configuration (main.js)

```javascript
// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import { i18n, useI18nStore } from './stores/modules/i18nStore'
import { useCurrencyStore } from './stores/modules/currencyStore'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// Persistence plugin for stores
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(i18n)

// Async initialization (non-blocking)
const i18nStore = useI18nStore()
i18nStore.initializeIfNeeded().catch(console.error)

const currencyStore = useCurrencyStore()
currencyStore.initializeIfNeeded().catch(console.error)

app.mount('#app')
```

---

### 3.3 HTTP Service (Axios + JWT)

The HTTP service centralizes all requests. It automatically handles JWT, token refresh, and language/currency headers.

```javascript
// src/stores/services/request_http.js
import axios from 'axios'
import { useI18nStore } from '@/stores/modules/i18nStore'
import { useCurrencyStore } from '@/stores/modules/currencyStore'

// Token helpers
export function getJWTToken() {
    return localStorage.getItem('access_token')
}

export function getRefreshToken() {
    return localStorage.getItem('refresh_token')
}

export function setTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
}

export function clearTokens() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
}

export function isAuthenticated() {
    return !!getJWTToken()
}

// Main request function
async function makeRequest(method, url, params = {}, config = {}) {
    const i18nStore = useI18nStore()
    const currencyStore = useCurrencyStore()
    
    const token = getJWTToken()
    const headers = {
        'Accept-Language': i18nStore?.locale || 'en',
        'X-Currency': currencyStore?.currentCurrency || 'USD',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...config.headers,
    }
    
    try {
        let response
        switch (method) {
            case 'GET':
                response = await axios.get(`/api/${url}`, { ...config, headers })
                break
            case 'POST':
                response = await axios.post(`/api/${url}`, params, { ...config, headers })
                break
            case 'PUT':
                response = await axios.put(`/api/${url}`, params, { ...config, headers })
                break
            case 'PATCH':
                response = await axios.patch(`/api/${url}`, params, { ...config, headers })
                break
            case 'DELETE':
                response = await axios.delete(`/api/${url}`, { ...config, headers })
                break
        }
        return response
    } catch (error) {
        // Auto-refresh token on 401
        if (error.response?.status === 401 && token) {
            const refreshToken = getRefreshToken()
            if (refreshToken) {
                try {
                    const refreshResponse = await axios.post('/api/auth/token/refresh/',
                        { refresh: refreshToken })
                    if (refreshResponse.data.access) {
                        setTokens(refreshResponse.data.access, refreshToken)
                        // Retry original request
                        return makeRequest(method, url, params, config)
                    }
                } catch {
                    clearTokens()
                }
            }
        }
        throw error
    }
}

// CRUD wrappers
export const get_request = (url, responseType = 'json') =>
    makeRequest('GET', url, {}, { responseType })

export const create_request = (url, params) =>
    makeRequest('POST', url, params)

export const update_request = (url, params) =>
    makeRequest('PUT', url, params)

export const patch_request = (url, params) =>
    makeRequest('PATCH', url, params)

export const delete_request = (url) =>
    makeRequest('DELETE', url)

// Global axios config
axios.defaults.timeout = 120000
```

---

### 3.4 Pinia Stores (CRUD)

Each store follows the same pattern: reactive state, computed getters, and CRUD actions.

```javascript
// src/stores/modules/productStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    get_request, create_request, update_request, delete_request
} from '@/stores/services/request_http'

export const useProductStore = defineStore('product', () => {
    // State
    const items = ref([])
    const currentItem = ref(null)
    const isLoading = ref(false)
    const isUpdating = ref(false)
    const error = ref(null)
    
    // Getters
    const totalItems = computed(() => items.value.length)
    const hasItems = computed(() => items.value.length > 0)
    const getById = computed(() => (id) => 
        items.value.find(item => item.id === id)
    )
    
    // Actions
    async function fetchItems() {
        isLoading.value = true
        error.value = null
        try {
            const response = await get_request('products/')
            items.value = response.data.products || []
            return { success: true, data: items.value }
        } catch (err) {
            error.value = err.response?.data?.error || 'Failed to load'
            return { success: false, error: error.value }
        } finally {
            isLoading.value = false
        }
    }
    
    async function fetchItem(id) {
        isLoading.value = true
        error.value = null
        try {
            const response = await get_request(`products/${id}/`)
            currentItem.value = response.data.product
            return { success: true, data: currentItem.value }
        } catch (err) {
            error.value = err.response?.data?.error || 'Product not found'
            currentItem.value = null
            return { success: false, error: error.value }
        } finally {
            isLoading.value = false
        }
    }
    
    async function createItem(payload) {
        isUpdating.value = true
        error.value = null
        try {
            const response = await create_request('products/create/', payload)
            const newItem = response.data.product
            items.value.unshift(newItem)
            return { success: true, message: response.data.message, data: newItem }
        } catch (err) {
            error.value = err.response?.data?.details || 'Failed to create'
            return { success: false, error: error.value }
        } finally {
            isUpdating.value = false
        }
    }
    
    async function updateItem(id, payload) {
        isUpdating.value = true
        error.value = null
        try {
            const response = await update_request(`products/${id}/update/`, payload)
            const updated = response.data.product
            const index = items.value.findIndex(item => item.id === id)
            if (index !== -1) items.value[index] = updated
            if (currentItem.value?.id === id) currentItem.value = updated
            return { success: true, message: response.data.message, data: updated }
        } catch (err) {
            error.value = err.response?.data?.details || 'Failed to update'
            return { success: false, error: error.value }
        } finally {
            isUpdating.value = false
        }
    }
    
    async function deleteItem(id) {
        isUpdating.value = true
        error.value = null
        try {
            const response = await delete_request(`products/${id}/delete/`)
            items.value = items.value.filter(item => item.id !== id)
            if (currentItem.value?.id === id) currentItem.value = null
            return { success: true, message: response.data.message }
        } catch (err) {
            error.value = err.response?.data?.error || 'Failed to delete'
            return { success: false, error: error.value }
        } finally {
            isUpdating.value = false
        }
    }
    
    function clearError() {
        error.value = null
    }
    
    return {
        // State
        items, currentItem, isLoading, isUpdating, error,
        // Getters
        totalItems, hasItems, getById,
        // Actions
        fetchItems, fetchItem, createItem, updateItem, deleteItem, clearError
    }
})
```

---

### 3.5 Router and Guards

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '@/stores/services/request_http'
import { useI18nStore } from '@/stores/modules/i18nStore'

const availableLanguages = ['en', 'es']

// Base routes
const baseRoutes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'Home' }
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/auth/LoginView.vue'),
        meta: { requiresGuest: true, title: 'Login' }
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { requiresAuth: true, title: 'Dashboard' }
    },
    {
        path: '/products',
        name: 'Products',
        component: () => import('@/views/products/ProductListView.vue'),
        meta: { title: 'Products' }
    },
    {
        path: '/products/:id',
        name: 'ProductDetail',
        component: () => import('@/views/products/ProductDetailView.vue'),
        meta: { title: 'Product Detail' }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/NotFoundView.vue')
    }
]

// Generate localized routes automatically
const routes = [
    ...baseRoutes,
    ...availableLanguages.flatMap(lang =>
        baseRoutes.map(route => ({
            ...route,
            path: `/${lang}${route.path === '/' ? '' : route.path}`,
            name: route.name ? `${route.name}-${lang}` : undefined,
        }))
    )
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) return savedPosition
        if (to.hash) return { el: to.hash, behavior: 'smooth' }
        return { top: 0, behavior: 'smooth' }
    }
})

// Guards
router.beforeEach((to, from, next) => {
    const i18nStore = useI18nStore()
    const urlLang = to.path.split('/')[1]
    
    // Detect and sync language from URL
    if (availableLanguages.includes(urlLang) && urlLang !== i18nStore.locale) {
        i18nStore.setLocale(urlLang)
    }
    
    // Auth guard
    if (to.meta.requiresAuth && !isAuthenticated()) {
        const targetLang = urlLang || i18nStore.locale || 'en'
        return next({ name: `Login-${targetLang}`, query: { redirect: to.fullPath } })
    }
    
    // Guest guard (redirect if already authenticated)
    if (to.meta.requiresGuest && isAuthenticated()) {
        const targetLang = urlLang || i18nStore.locale || 'en'
        return next({ name: `Home-${targetLang}` })
    }
    
    // Update page title
    document.title = to.meta.title || 'My Application'
    
    next()
})

export default router
```

---

### 3.6 Internationalization (i18n)

```javascript
// src/stores/modules/i18nStore.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

// Translation messages
const messages = {
    en: {
        common: {
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
            loading: 'Loading...',
            error: 'An error occurred'
        },
        auth: {
            login: 'Log In',
            logout: 'Log Out',
            register: 'Register'
        },
        products: {
            title: 'Products',
            addToCart: 'Add to Cart',
            outOfStock: 'Out of Stock'
        }
    },
    es: {
        common: {
            save: 'Guardar',
            cancel: 'Cancelar',
            delete: 'Eliminar',
            loading: 'Cargando...',
            error: 'Ocurrió un error'
        },
        auth: {
            login: 'Iniciar Sesión',
            logout: 'Cerrar Sesión',
            register: 'Registrarse'
        },
        products: {
            title: 'Productos',
            addToCart: 'Agregar al Carrito',
            outOfStock: 'Agotado'
        }
    }
}

// Create i18n instance
export const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages
})

// Store for language management
export const useI18nStore = defineStore('i18n', () => {
    const locale = ref('en')
    const availableLocales = ['en', 'es']
    
    function setLocale(newLocale) {
        if (availableLocales.includes(newLocale)) {
            locale.value = newLocale
            i18n.global.locale.value = newLocale
            localStorage.setItem('locale', newLocale)
        }
    }
    
    async function initializeIfNeeded() {
        const saved = localStorage.getItem('locale')
        if (saved && availableLocales.includes(saved)) {
            setLocale(saved)
        } else {
            // Detect from browser
            const browserLang = navigator.language.split('-')[0]
            setLocale(availableLocales.includes(browserLang) ? browserLang : 'en')
        }
    }
    
    return { locale, availableLocales, setLocale, initializeIfNeeded }
}, {
    persist: true  // Persist to localStorage
})
```

---

### 3.7 Testing (Frontend)

#### 3.7.1 Unit Testing (Jest + Vue Test Utils)

Configuration and conventions detected in the project:

- **Runner:** Jest (`frontend/package.json` script `test`).
- **Config:** `frontend/jest.config.cjs`
  - `testMatch`: `test/**/*.test.js`
  - Ignores E2E: `testPathIgnorePatterns: ['<rootDir>/e2e/']`
  - Transformers:
    - Vue: `@vue/vue3-jest`
    - JS: `babel-jest`
    - Assets/CSS: `jest-transform-stub` + `identity-obj-proxy`
- **Setup:** `frontend/jest.setup.js` loads `@testing-library/jest-dom`.

Unit test structure:

```
frontend/
└── test/
    ├── stores/       # Pinia unit tests (actions/getters)
    ├── router/       # Guards and navigation
    ├── composables/  # Hooks/composables
    ├── shared/       # Shared helpers
    └── components/   # Component tests with Vue Test Utils
```

Common patterns:

- **Stores (Pinia):**
  - `setActivePinia(createPinia())`
  - HTTP mock with `axios-mock-adapter` on `axios`.
- **Components:**
  - `mount()` from Vue Test Utils.
  - `jest.mock()` for external dependencies (`gsap`, `vue-router`, `vue3-google-login`, etc.).
  - `stubs` for complex child components.

Real example (store test with API mock):

```js
setActivePinia(createPinia());
mock.onGet('/api/users/').reply(200, usersData);
await store.fetchUsersData();
expect(store.users).toEqual(usersData);
```

#### 3.7.2 Flow Testing (E2E) with Playwright

- **Runner:** `@playwright/test`
- **Config:** `frontend/playwright.config.mjs`
  - `testDir: './e2e'`
  - Automatically starts the dev server via `webServer.command: npm run dev ...`
  - HTML report enabled (`playwright show-report`).

API mocking strategy for E2E:

- Requests to `**/api/**` are intercepted with `page.route(...)`.
- Helpers like `e2e/helpers/api.js` and `e2e/helpers/authSignInMocks.js` return deterministic responses.

Real example (E2E):

```js
await page.goto('/sign_in');
await page.locator('#email').fill('client@example.com');
await page.getByRole('button', { name: 'Iniciar sesión' }).click();
await expect(page).toHaveURL(/\/dashboard/);
```

#### 3.7.3 Commands to Run Tests

```bash
npm run test
npm run e2e
npm run e2e:ui
npm run e2e:headed
npm run e2e:report
```

---

## 4. Standard Dependencies

### 4.1 Backend (requirements.txt)

| Category | Package | Purpose |
|----------|---------|----------|
| Core | Django>=4.2 | Web framework |
| Core | djangorestframework | REST API |
| Auth | djangorestframework-simplejwt | JWT authentication |
| CORS | django-cors-headers | CORS handling |
| Cache | django-redis | Redis cache |
| Images | Pillow | Image processing |
| Images | easy-thumbnails | Automatic thumbnails |
| Cleanup | django-cleanup | File cleanup |
| Testing | Faker | Test data |
| Testing | pytest | Test runner (backend) |
| Testing | pytest-django | pytest + Django integration |
| Testing | pytest-cov | Test coverage |
| Testing | coverage | Coverage measurement |
| HTTP | requests | External integrations |

### 4.2 Frontend (package.json)

| Category | Package | Purpose |
|----------|---------|----------|
| Core | vue@^3.x | Reactive framework |
| Build | vite + @vitejs/plugin-vue | Fast bundler |
| State | pinia | Store management |
| State | pinia-plugin-persistedstate | Store persistence |
| Routing | vue-router@^4.x | SPA navigation |
| HTTP | axios | HTTP client |
| i18n | vue-i18n | Internationalization |
| Styles | tailwindcss | CSS utilities |
| UI | @headlessui/vue | Accessible components |
| Icons | @heroicons/vue | SVG icons |
| Testing | jest | Unit test runner |
| Testing | @vue/test-utils | Vue component testing utilities |
| Testing | @vue/vue3-jest | Vue SFC transform for Jest |
| Testing | babel-jest | JavaScript transform for Jest |
| Testing | @testing-library/jest-dom | DOM matchers for Jest |
| Testing | axios-mock-adapter | Axios mock for unit tests |
| Testing | @playwright/test | E2E / flow tests |

---

## 5. Execution Commands

### 5.1 Backend (Django)

```bash
# 1. Create and activate virtual environment
cd backend
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate        # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Environment variables (create .env)
# DJANGO_SECRET_KEY=...
# DATABASE_URL=...
# EMAIL_HOST_PASSWORD=...

# 4. Migrations
python manage.py makemigrations
python manage.py migrate

# 5. Create superuser
python manage.py createsuperuser

# 6. Create fake data
python manage.py create_fake_data --users 20 --products 50 --orders 30

# 7. Delete fake data
python manage.py delete_fake_data --confirm

# 8. Tests
pytest
pytest -q

# 9. Development server
python manage.py runserver        # http://localhost:8000

# 10. Production server (with gunicorn)
gunicorn core_project.wsgi:application --bind 0.0.0.0:8000
```

### 5.2 Frontend (Vue + Vite)

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Development server
npm run dev                       # http://localhost:5173

# 3. Production build
npm run build

# 4. Preview build
npm run preview

# 5. Linting
npm run lint

# 6. Tests
npm run test

# 7. E2E
npm run e2e
```

### 5.3 Development Access URLs

| Resource | URL | Description |
|----------|-----|-------------|
| Frontend | http://localhost:5173 | Vue application |
| API | http://localhost:8000/api/ | REST endpoints |
| Admin | http://localhost:8000/admin/ | Django Admin panel |
| API Docs | http://localhost:8000/api/docs/ | Documentation (if enabled) |

---

## 6. New Project Checklist

Use this list when starting a new project to ensure all standards are followed.

### 6.1 Initial Configuration

- [ ] Create repository with backend/ and frontend/ structure
- [ ] Configure .gitignore (venv, node_modules, .env, db.sqlite3, media/)
- [ ] Edit `README.md` at project start to include a summary of:
  - Environment setup (backend and frontend)
  - Migrations
  - Fake data creation/deletion
  - How to run tests (unit and e2e)
  - How to run servers (backend and frontend)
- [ ] Create .env.example file with required variables
- [ ] Create `guidelines.md` at the root with the standard **Change Implementation Guidelines** content
- [ ] Define custom AUTH_USER_MODEL from the start
- [ ] Configure CORS for local frontend (localhost:5173)
- [ ] Configure JWT with appropriate expiration times

### 6.2 Backend

- [ ] Create folder structure: models/, serializers/, views/, urls/
- [ ] Implement User model with required fields
- [ ] Create separate serializers: List, Detail, CreateUpdate
- [ ] Implement views with @api_view and explicit permissions
- [ ] Organize URLs by functional module
- [ ] Configure Django Admin with detailed ModelAdmins
- [ ] Create create_fake_data and delete_fake_data commands
- [ ] Verify and integrate `django_attachments` if the project requires image galleries
- [ ] Implement services for complex business logic

### 6.3 Frontend

- [ ] Configure Vite with proxy to backend (/api → localhost:8000)
- [ ] Implement HTTP service with JWT handling and refresh
- [ ] Create Pinia stores with standard CRUD pattern
- [ ] Configure router with auth guards
- [ ] Implement internationalization (i18n)
- [ ] Configure TailwindCSS
- [ ] Create reusable base components
- [ ] Implement global error handling

### 6.4 Before Production

- [ ] Migrate to MySQL database
- [ ] Configure Redis for cache and sessions
- [ ] Move ALL credentials to environment variables
- [ ] Configure HTTPS and update CORS/CSRF
- [ ] Configure collectstatic for static files
- [ ] Configure media file server (S3, etc.)
- [ ] Implement appropriate logging
- [ ] Run delete_fake_data --confirm
- [ ] Review permissions on sensitive endpoints
- [ ] Production build for frontend

---

> **This document should be updated when new technologies, patterns, or best practices are adopted by the team. The current version reflects the consolidation of three existing reference templates.**

---

## Appendix A: Change Implementation Guide

This appendix describes the standard steps to follow every time a change is made to the project (backend or frontend). The goal is to preserve existing behavior, avoid regressions, and keep the system well-documented and testable.

### A.1 Mandatory Checklist

#### 1. Validate the business logic around the change

- Confirm that the new behavior is consistent with existing business rules.
- Verify implicit contracts (API responses, error formats, background jobs, emails, etc.).
- If a test requires changing existing behavior, explicitly decide whether the behavior or the test is the source of truth.

#### 2. Keep the code documented with English docstrings

- Public functions, classes, and complex methods must have clear English docstrings.
- Docstrings must explain:
  - Purpose and intent ("what" and "why").
  - Parameters and return values.
  - Important side effects, invariants, or assumptions.
- When modifying existing behavior, update the docstring to remain accurate.

#### 3. Add or update automated tests

- For any new behavior, add tests that cover:
  - Happy path.
  - Relevant edge cases and error conditions.
- When changing existing behavior:
  - Update tests to describe the **new** intended behavior.
  - Avoid weakening assertions unless it is a deliberate design decision.
- Run the relevant full test suite (backend and/or frontend) and ensure it passes before merging.

#### 4. Verify and maintain test data

- Review existing fixtures and fake data used by affected areas.
- Update or extend backend fixtures, management commands, or fake data generators when:
  - New fields are introduced.
  - Business rules change (e.g., new required relationships, new roles, new states).
- Ensure test data is realistic enough to facilitate debugging and issue reproduction.

#### 5. Verify and update the User Manual module

- If any user-facing behavior changes (API, UI flows, emails, reports, roles/permissions, etc.), review the user manual or help content.
- Update or add entries in the user manual to reflect current behavior.
- When in doubt, document:
  - New features or flows.
  - Changes to existing flows (including error messages and edge cases users might encounter).

### A.2 Optional / Recommended Considerations

These items are not always required, but should be considered for any non-trivial change.

#### Database migrations and data integrity

- Check if model changes require Django migrations.
- Consider data migration scripts if existing records need to be adapted.
- Verify that constraints and defaults remain correct for production data.

#### Backward compatibility

- For public APIs, avoid breaking changes in request/response shape unless explicitly planned.
- Where possible, deprecate behavior gradually (e.g., support both old and new fields for a period).

#### Performance and scalability

- Evaluate if the change introduces heavier queries, N+1 issues, or expensive computations.
- For critical paths, consider adding tests or instrumentation to detect regressions.

#### Security and permissions

- Re-verify permission checks, access control, and visibility rules affected by the change.
- Ensure error messages do not leak sensitive information.
- Review user input handling, file uploads, and external integrations.

#### Logging and observability

- Add or adjust logging for important flows (success and failure paths) when useful for debugging.
- Avoid logging sensitive data (passwords, tokens, personally identifiable information).

#### Configuration and environment

- If new settings or environment variables are added, document them and provide safe defaults.
- Ensure local, staging, and production environments can be configured consistently.

#### Code style and consistency

- Follow the existing project style (formatting, naming, folder structure).
- Prefer small, focused changes over large, mixed refactors.

#### Review and communication

- When submitting changes, include a concise description of:
  - What was changed.
  - Why it was changed.
  - How it was tested.
- Highlight any breaking changes, data migrations, or manual steps required after deployment.
- Propose a very short commit message consistent with the type of change:
  - For a **FEAT** (feature/intent/adjustment), use a brief phrase that captures the intended behavior or feature in English.
  - For a **FIX** (bug fix), use a brief phrase that explicitly mentions the applied fix in English.

### A.3 Visual Process Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE IMPLEMENTING                          │
├─────────────────────────────────────────────────────────────────┤
│  □ Understand the requirement and its impact                     │
│  □ Identify affected areas (models, views, frontend, etc.)      │
│  □ Review existing tests in those areas                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DURING IMPLEMENTATION                        │
├─────────────────────────────────────────────────────────────────┤
│  □ Write/update English docstrings                               │
│  □ Follow established project patterns                          │
│  □ Create migrations if model changes exist                     │
│  □ Update fake data if new fields/relationships exist           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AFTER IMPLEMENTING                           │
├─────────────────────────────────────────────────────────────────┤
│  □ Write/update tests (happy path + edge cases)                  │
│  □ Run full relevant test suite                                  │
│  □ Update user manual if applicable                              │
│  □ Review security and permissions                               │
│  □ Prepare descriptive commit message                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE MERGE/DEPLOY                          │
├─────────────────────────────────────────────────────────────────┤
│  □ Code review completed                                        │
│  □ All tests pass                                               │
│  □ Documentation updated                                        │
│  □ Breaking changes communicated to the team                    │
└─────────────────────────────────────────────────────────────────┘
```

---

> **Note:** This appendix complements the technical architecture with process practices. Following these guidelines helps maintain code quality and reduces the risk of introducing bugs in production.
