# Sistema de Suscripciones con Wompi - Guía de Configuración

## 📋 Requisitos Previos

### 1. Instalar dependencias
El task queue (Huey) y el cliente de Redis ya están declarados en
`requirements.txt` (`huey==2.5.2`, `redis`). Instalarlos con:
```bash
source venv/bin/activate
pip install -r requirements.txt
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

# Redis / Huey — lo consume HUEY en gym_project/settings.py
REDIS_URL=redis://localhost:6379/1
```

### 2. Migraciones

Ya están aplicadas, pero si necesitas recrearlas:
```bash
source venv/bin/activate
python manage.py migrate
```

## 🏃 Ejecución

### 1. Servidor Django
```bash
source venv/bin/activate
python manage.py runserver
```

### 2. Huey Consumer (procesa las tareas)

En **desarrollo** normalmente no hace falta: `HUEY` se configura con
`immediate=not IS_PRODUCTION` (ver `settings.py`), así que las tareas se
ejecutan de forma síncrona dentro del propio proceso de Django.

En **producción** un único consumer procesa tanto las tareas encoladas como
las periódicas (`@periodic_task`) — no existen procesos "worker" y "beat"
separados:
```bash
source venv/bin/activate
python manage.py run_huey
```

En el servidor esto corre como el servicio systemd **`gym-project-huey`**.

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

## 🔄 Tareas Programadas (Huey)

### Cobros Mensuales Automáticos
- **Tarea:** `process_monthly_subscriptions` (`gym_app/tasks.py`, Huey `@task()`)
- **Frecuencia:** diaria (madrugada). El disparo se agenda con un
  `@periodic_task(crontab(...))` de Huey o un cron del sistema que encola la
  tarea — igual que el resto de tareas periódicas del proyecto
  (`gym_app/notification_tasks.py`, `secop_tasks.py`, etc.).
- **Función:** procesa todas las suscripciones activas cuyo `next_billing_date`
  ya venció.

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

### Ver logs de Huey
```bash
# Desarrollo: el consumer imprime en la terminal donde corre run_huey.
# Producción: journalctl -u gym-project-huey -f
```

### Ver logs de Django
```bash
tail -f debug.log
```

### Verificar la cola en Redis
```bash
# Huey usa la DB de Redis indicada en REDIS_URL (por defecto /1)
redis-cli -n 1 keys 'huey*'
```

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

# Encola la tarea (en dev con immediate=True corre inline al instante).
process_monthly_subscriptions()
```

## 🔐 Seguridad

- ✅ Webhook valida firma HMAC-SHA256
- ✅ Endpoints protegidos con autenticación JWT
- ✅ CSRF exempt solo en webhook (necesario para Wompi)
- ✅ Logs de todas las transacciones
- ✅ Validación de ownership en cancelación

## 📝 Notas Importantes

1. **Redis es requerido** para Huey — asegúrate de que esté corriendo
2. En **producción** el consumer **`run_huey`** (systemd `gym-project-huey`)
   debe estar corriendo para las tareas encoladas y periódicas
3. **Webhook URL** debe ser HTTPS en producción
4. **payment_source_id** se guarda para cobros recurrentes
5. **Roles de usuario** se actualizan automáticamente según plan

## 🐛 Troubleshooting

### Redis no conecta
```bash
sudo systemctl status redis
sudo systemctl restart redis
```

### Huey no procesa tareas
```bash
# Verificar que el consumer está corriendo
ps aux | grep run_huey
# En el servidor:
sudo systemctl status gym-project-huey

# Reiniciar el consumer
sudo systemctl restart gym-project-huey
# O en desarrollo:
pkill -f run_huey
python manage.py run_huey
```

### Webhook no recibe eventos
- Verificar URL en Wompi dashboard
- Verificar que endpoint es accesible públicamente
- Revisar logs: `tail -f debug.log | grep webhook`
