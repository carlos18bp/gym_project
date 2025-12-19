# API de Suscripciones - Documentación Completa

## 📋 Endpoints Disponibles

### 1. Configuración de Wompi
**GET** `/api/subscriptions/wompi-config/`

Obtiene la configuración pública de Wompi (llave pública y entorno).

**Autenticación:** No requerida

**Response:**
```json
{
  "public_key": "pub_test_b3LGmVloYasfVNKpZOc5ND0MMyAgQxFG",
  "environment": "test"
}
```

---

### 2. Generar Firma de Integridad
**POST** `/api/subscriptions/generate-signature/`

Genera una firma SHA256 para validar transacciones con Wompi.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "amount_in_cents": 2290000,
  "currency": "COP",
  "reference": "sub_cliente_123"
}
```

**Response:**
```json
{
  "signature": "abc123def456..."
}
```

---

### 3. Crear Suscripción
**POST** `/api/subscriptions/create/`

Crea una nueva suscripción y procesa el primer pago.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "plan_type": "cliente",
  "payment_source_id": "3891"
}
```

**Plan Types:**
- `basico` - Gratis (0 COP)
- `cliente` - 50,000 COP/mes
- `corporativo` - 150,000 COP/mes

**Response:**
```json
{
  "subscription_id": 1,
  "plan_type": "cliente",
  "status": "active",
  "amount": "50000.00",
  "next_billing_date": "2024-01-19",
  "user_role": "client",
  "message": "Subscription created successfully"
}
```

---

### 4. Obtener Suscripción Actual
**GET** `/api/subscriptions/current/`

Obtiene la suscripción activa del usuario autenticado.

**Autenticación:** Requerida (JWT)

**Response (con suscripción activa):**
```json
{
  "id": 1,
  "user_email": "usuario@example.com",
  "user_name": "Juan Pérez",
  "plan_type": "cliente",
  "payment_source_id": "3891",
  "status": "active",
  "next_billing_date": "2024-01-19",
  "amount": "50000.00",
  "created_at": "2023-12-19T10:00:00Z",
  "updated_at": "2023-12-19T10:00:00Z"
}
```

**Response (sin suscripción):**
```json
{
  "subscription": null,
  "message": "No active subscription found"
}
```

---

### 5. Cancelar Suscripción
**PATCH** `/api/subscriptions/cancel/`

Cancela la suscripción activa del usuario y cambia su rol a `basic`.

**Autenticación:** Requerida (JWT)

**Response:**
```json
{
  "id": 1,
  "user_email": "usuario@example.com",
  "user_name": "Juan Pérez",
  "plan_type": "cliente",
  "payment_source_id": "3891",
  "status": "cancelled",
  "next_billing_date": "2024-01-19",
  "amount": "50000.00",
  "created_at": "2023-12-19T10:00:00Z",
  "updated_at": "2023-12-19T15:30:00Z"
}
```

---

### 6. Actualizar Método de Pago
**PATCH** `/api/subscriptions/update-payment-method/`

Actualiza el token de pago (payment_source_id) de la suscripción activa.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "payment_source_id": "4567"
}
```

**Response:**
```json
{
  "id": 1,
  "user_email": "usuario@example.com",
  "user_name": "Juan Pérez",
  "plan_type": "cliente",
  "payment_source_id": "4567",
  "status": "active",
  "next_billing_date": "2024-01-19",
  "amount": "50000.00",
  "created_at": "2023-12-19T10:00:00Z",
  "updated_at": "2023-12-19T16:00:00Z"
}
```

---

### 7. Historial de Pagos
**GET** `/api/subscriptions/payments/`

Obtiene el historial de todos los pagos del usuario.

**Autenticación:** Requerida (JWT)

**Response:**
```json
[
  {
    "id": 1,
    "amount": "50000.00",
    "status": "approved",
    "transaction_id": "123-456-789",
    "reference": "SUB-1-20231219120000",
    "payment_date": "2023-12-19T12:00:00Z",
    "error_message": null
  },
  {
    "id": 2,
    "amount": "50000.00",
    "status": "declined",
    "transaction_id": "123-456-790",
    "reference": "SUB-1-20240119120000",
    "payment_date": "2024-01-19T12:00:00Z",
    "error_message": "Insufficient funds"
  }
]
```

**Payment Statuses:**
- `approved` - Pago exitoso
- `declined` - Pago rechazado
- `pending` - Pago pendiente
- `error` - Error en el pago

---

### 8. Webhook de Wompi
**POST** `/api/subscriptions/webhook/`

Endpoint para recibir notificaciones de Wompi sobre el estado de las transacciones.

**Autenticación:** Validación de firma HMAC-SHA256

**Headers:**
```
X-Wompi-Signature: {signature}
Content-Type: application/json
```

**Request Body:**
```json
{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "123-456",
      "status": "APPROVED",
      "reference": "SUB-1-20231219120000",
      "amount_in_cents": 5000000,
      "currency": "COP"
    }
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Webhook processed"
}
```

**Configuración en Wompi:**
1. Ir al dashboard de Wompi
2. Configurar webhook URL: `https://tu-dominio.com/api/subscriptions/webhook/`
3. Seleccionar evento: `transaction.updated`

---

## 🔄 Flujo de Suscripción

### Crear Nueva Suscripción

```javascript
// 1. Obtener configuración de Wompi
const config = await fetch('/api/subscriptions/wompi-config/');
const { public_key } = await config.json();

// 2. Tokenizar tarjeta con Wompi (frontend)
// Usar public_key para crear payment_source_id

// 3. Generar firma de integridad
const signature = await fetch('/api/subscriptions/generate-signature/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount_in_cents: 5000000,
    currency: 'COP',
    reference: 'sub_cliente_123'
  })
});

// 4. Crear suscripción
const subscription = await fetch('/api/subscriptions/create/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    plan_type: 'cliente',
    payment_source_id: '3891'
  })
});
```

### Actualizar Método de Pago

```javascript
// 1. Tokenizar nueva tarjeta con Wompi
// 2. Actualizar payment_source_id
const updated = await fetch('/api/subscriptions/update-payment-method/', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payment_source_id: '4567'
  })
});
```

### Cancelar Suscripción

```javascript
const cancelled = await fetch('/api/subscriptions/cancel/', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer {token}'
  }
});
```

---

## 🔐 Autenticación

Todos los endpoints (excepto `wompi-config` y `webhook`) requieren autenticación JWT.

**Header:**
```
Authorization: Bearer {access_token}
```

---

## 📊 Modelos de Datos

### Subscription
```python
{
  "id": int,
  "user": ForeignKey(User),
  "plan_type": str,  # basico, cliente, corporativo
  "payment_source_id": str,
  "status": str,  # active, cancelled, expired
  "next_billing_date": date,
  "amount": decimal,
  "created_at": datetime,
  "updated_at": datetime
}
```

### PaymentHistory
```python
{
  "id": int,
  "subscription": ForeignKey(Subscription),
  "amount": decimal,
  "status": str,  # approved, declined, pending, error
  "transaction_id": str,
  "reference": str,
  "payment_date": datetime,
  "error_message": str
}
```

---

## 🎯 Mapeo de Roles

Cuando se crea o actualiza una suscripción, el rol del usuario se actualiza automáticamente:

| Plan Type     | User Role          |
|---------------|-------------------|
| basico        | basic             |
| cliente       | client            |
| corporativo   | corporate_client  |

---

## ⚠️ Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400    | Bad Request - Datos inválidos o faltantes |
| 401    | Unauthorized - Token JWT inválido o faltante |
| 404    | Not Found - Suscripción no encontrada |
| 500    | Internal Server Error - Error del servidor |

---

## 🧪 Testing

### Ejemplo con cURL

```bash
# Obtener configuración
curl -X GET http://localhost:8000/api/subscriptions/wompi-config/

# Generar firma
curl -X POST http://localhost:8000/api/subscriptions/generate-signature/ \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"amount_in_cents": 5000000, "currency": "COP", "reference": "test_123"}'

# Crear suscripción
curl -X POST http://localhost:8000/api/subscriptions/create/ \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"plan_type": "cliente", "payment_source_id": "3891"}'

# Obtener suscripción actual
curl -X GET http://localhost:8000/api/subscriptions/current/ \
  -H "Authorization: Bearer {token}"

# Cancelar suscripción
curl -X PATCH http://localhost:8000/api/subscriptions/cancel/ \
  -H "Authorization: Bearer {token}"

# Actualizar método de pago
curl -X PATCH http://localhost:8000/api/subscriptions/update-payment-method/ \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"payment_source_id": "4567"}'

# Historial de pagos
curl -X GET http://localhost:8000/api/subscriptions/payments/ \
  -H "Authorization: Bearer {token}"
```

---

## 📝 Notas Importantes

1. **payment_source_id** es el token de Wompi que se obtiene al tokenizar una tarjeta
2. **Webhooks** validan la firma HMAC-SHA256 automáticamente
3. **Cobros automáticos** se procesan diariamente a las 2:00 AM vía Celery
4. **Roles de usuario** se actualizan automáticamente según el plan
5. **Plan básico** es gratuito y no requiere payment_source_id
