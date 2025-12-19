# Sistema de Suscripciones con Wompi - Guía de Configuración

## 📋 Requisitos Previos

### 1. Instalar dependencias
```bash
pip install celery redis django-celery-beat
```

### 2. Instalar y configurar Redis
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Verificar que Redis está corriendo
redis-cli ping
# Debe responder: PONG
```

## 🚀 Configuración

### 1. Variables de Entorno

Crear archivo `.env` en el directorio backend (opcional):
```bash
# Wompi Environment (test o production)
WOMPI_ENVIRONMENT=test

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 2. Migraciones

Ya están aplicadas, pero si necesitas recrearlas:
```bash
source ../gym_project_env/bin/activate
python manage.py migrate
```

## 🏃 Ejecución

### 1. Servidor Django
```bash
source ../gym_project_env/bin/activate
python manage.py runserver
```

### 2. Celery Worker (en otra terminal)
```bash
source ../gym_project_env/bin/activate
celery -A gym_project worker --loglevel=info
```

### 3. Celery Beat (tareas programadas - en otra terminal)
```bash
source ../gym_project_env/bin/activate
celery -A gym_project beat --loglevel=info
```

## 📡 Endpoints Disponibles

### 1. Generar Firma de Integridad
```http
POST /api/subscriptions/generate-signature/
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 5000000,
  "currency": "COP",
  "reference": "SUB-123-20231219"
}
```

### 2. Crear Suscripción
```http
POST /api/subscriptions/create/
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan_type": "cliente",
  "payment_source_id": "tok_test_12345_ABCDEF"
}
```

**Plan Types:**
- `basico` - Gratis (0 COP)
- `cliente` - 50,000 COP/mes
- `corporativo` - 150,000 COP/mes

### 3. Cancelar Suscripción
```http
POST /api/subscriptions/{subscription_id}/cancel/
Authorization: Bearer {token}
```

### 4. Webhook de Wompi
```http
POST /api/subscriptions/webhook/
X-Wompi-Signature: {signature}
Content-Type: application/json

{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "123-456",
      "status": "APPROVED",
      "reference": "SUB-1-20231219120000"
    }
  }
}
```

## 🔄 Tareas Programadas (Celery)

### Cobros Mensuales Automáticos
- **Tarea:** `process_monthly_subscriptions`
- **Frecuencia:** Diariamente a las 2:00 AM
- **Función:** Procesa todas las suscripciones activas que tienen `next_billing_date` <= hoy

**Proceso:**
1. Busca suscripciones activas vencidas
2. Genera transacción en Wompi usando `payment_source_id`
3. Si pago exitoso: actualiza `next_billing_date` (+30 días)
4. Si pago falla: marca suscripción como `expired` y downgrade a rol `basic`

## 🪝 Webhooks de Wompi

### Configuración en Wompi Dashboard
1. Ir a configuración de webhooks en Wompi
2. Agregar URL: `https://tu-dominio.com/api/subscriptions/webhook/`
3. Seleccionar eventos: `transaction.updated`

### Validación de Firma
El webhook valida automáticamente la firma usando `WOMPI_EVENTS_KEY`:
```python
expected_signature = hmac.new(
    WOMPI_EVENTS_KEY.encode(),
    raw_body.encode(),
    hashlib.sha256
).hexdigest()
```

### Estados de Transacción Manejados
- **APPROVED:** Activa suscripción, actualiza rol de usuario
- **DECLINED:** Expira suscripción, downgrade a basic
- **VOIDED:** Registra en logs
- **ERROR:** Registra error en logs

## 🔧 Cambiar entre Test y Production

### Modo Test (por defecto)
```bash
export WOMPI_ENVIRONMENT=test
```

### Modo Production
```bash
export WOMPI_ENVIRONMENT=production
```

Reiniciar servidor Django después del cambio.

## 📊 Monitoreo

### Ver logs de Celery
```bash
# En la terminal donde corre celery worker
# Los logs aparecen automáticamente
```

### Ver logs de Django
```bash
tail -f debug.log
```

### Verificar tareas en Django Admin
1. Ir a `/admin/`
2. Buscar "Periodic tasks" (django_celery_beat)
3. Ver historial de ejecuciones

## 🧪 Testing

### Probar webhook localmente con ngrok
```bash
# Instalar ngrok
ngrok http 8000

# Usar la URL de ngrok en Wompi dashboard
# Ejemplo: https://abc123.ngrok.io/api/subscriptions/webhook/
```

### Probar tarea de cobros manualmente
```python
from gym_app.tasks import process_monthly_subscriptions
process_monthly_subscriptions.delay()
```

## 🔐 Seguridad

- ✅ Webhook valida firma HMAC-SHA256
- ✅ Endpoints protegidos con autenticación JWT
- ✅ CSRF exempt solo en webhook (necesario para Wompi)
- ✅ Logs de todas las transacciones
- ✅ Validación de ownership en cancelación

## 📝 Notas Importantes

1. **Redis es requerido** para Celery - asegúrate de que esté corriendo
2. **Celery Beat** debe estar corriendo para tareas programadas
3. **Webhook URL** debe ser HTTPS en producción
4. **payment_source_id** se guarda para cobros recurrentes
5. **Roles de usuario** se actualizan automáticamente según plan

## 🐛 Troubleshooting

### Redis no conecta
```bash
sudo systemctl status redis
sudo systemctl restart redis
```

### Celery no procesa tareas
```bash
# Verificar que worker está corriendo
ps aux | grep celery

# Reiniciar worker
pkill -f 'celery worker'
celery -A gym_project worker --loglevel=info
```

### Webhook no recibe eventos
- Verificar URL en Wompi dashboard
- Verificar que endpoint es accesible públicamente
- Revisar logs: `tail -f debug.log | grep webhook`
