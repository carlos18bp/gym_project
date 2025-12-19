# 🔍 Guía de Debugging - Firma de Wompi

## Error: "La firma es inválida"

Este error ocurre cuando la firma SHA256 generada no coincide con la esperada por Wompi.

---

## ✅ Pasos para Resolver

### 1. Verificar el Integrity Secret en Wompi Dashboard

**Ir a:** Wompi Dashboard → Desarrolladores → Secretos para integración técnica

**Buscar:** Integrity Secret (NO es la llave pública ni privada)

**Formato:**
- Test: `test_integrity_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Producción: `prod_integrity_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**⚠️ IMPORTANTE:** El Integrity Secret es diferente de:
- Public Key (`pub_test_xxx` o `pub_prod_xxx`)
- Private Key (`prv_test_xxx` o `prv_prod_xxx`)
- Events Key (`test_events_xxx` o `prod_events_xxx`)

---

### 2. Actualizar el Integrity Secret en Django Settings

Editar: `backend/gym_project/settings.py`

```python
# Línea 177 (para test)
WOMPI_INTEGRITY_KEY = 'test_integrity_TU_CLAVE_AQUI'

# Línea 172 (para production)
WOMPI_INTEGRITY_KEY = 'prod_integrity_TU_CLAVE_AQUI'
```

**Reiniciar el servidor Django después de cambiar:**
```bash
# Ctrl+C para detener
python manage.py runserver
```

---

### 3. Usar el Endpoint de Debug

**Endpoint:** `POST /api/subscriptions/debug-signature/`

Este endpoint muestra todos los detalles de la generación de la firma.

**Ejemplo con cURL:**
```bash
curl -X POST http://localhost:8000/api/subscriptions/debug-signature/ \
  -H "Content-Type: application/json" \
  -d '{
    "amount_in_cents": 2290000,
    "currency": "COP",
    "reference": "sub_cliente_1766157166323"
  }'
```

**Response esperado:**
```json
{
  "reference": "sub_cliente_1766157166323",
  "amount_in_cents": 2290000,
  "currency": "COP",
  "integrity_key": "test_integrity_0h9R8sLVKQd3khMyvveBwbS3Cchql6T9",
  "concatenated_string": "sub_cliente_17661571663232290000COPtest_integrity_0h9R8sLVKQd3khMyvveBwbS3Cchql6T9",
  "signature": "abc123def456...",
  "environment": "test"
}
```

---

### 4. Verificar la Fórmula de Concatenación

**Fórmula correcta:**
```
concatenated = reference + amount_in_cents + currency + integrity_secret
```

**Ejemplo real:**
```
"sub_cliente_1766157166323" + "2290000" + "COP" + "test_integrity_0h9R8sLVKQd3khMyvveBwbS3Cchql6T9"
= "sub_cliente_17661571663232290000COPtest_integrity_0h9R8sLVKQd3khMyvveBwbS3Cchql6T9"
```

**⚠️ IMPORTANTE:**
- NO hay espacios entre los valores
- NO hay guiones, comas, ni separadores
- Los valores se concatenan directamente

---

### 5. Verificar que el Frontend envía los datos correctos

**Verificar en el frontend:**
```javascript
// Los datos deben ser EXACTAMENTE iguales al generar la firma y al enviar a Wompi

const reference = "sub_cliente_1766157166323";  // Mismo valor
const amount_in_cents = 2290000;                 // Mismo valor (número, no string)
const currency = "COP";                          // Mismo valor

// 1. Generar firma en backend
const signatureResponse = await fetch('/api/subscriptions/generate-signature/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount_in_cents: amount_in_cents,  // Mismo valor
    currency: currency,                 // Mismo valor
    reference: reference                // Mismo valor
  })
});

const { signature } = await signatureResponse.json();

// 2. Enviar a Wompi Widget - USAR LOS MISMOS VALORES
const wompiData = {
  currency: currency,                   // MISMO valor
  amountInCents: amount_in_cents,       // MISMO valor
  reference: reference,                 // MISMO valor
  signature: signature
};
```

---

### 6. Checklist de Verificación

- [ ] **Integrity Secret correcto** - Copiado desde Wompi Dashboard
- [ ] **Servidor reiniciado** - Después de cambiar settings.py
- [ ] **Mismo reference** - Frontend y backend usan el mismo valor
- [ ] **Mismo amount_in_cents** - Frontend y backend usan el mismo valor
- [ ] **Mismo currency** - Frontend y backend usan el mismo valor (generalmente "COP")
- [ ] **Entorno correcto** - Test o Production coincide en Wompi y Django

---

### 7. Verificar Logs del Servidor

Los logs ahora muestran información detallada:

```bash
# Ver logs en la terminal donde corre Django
# Buscar líneas como:

INFO Signature generation - Reference: sub_cliente_123, Amount: 2290000, Currency: COP
INFO Concatenated string (without key): sub_cliente_1232290000COP
INFO Using integrity key: test_integrity_0h9R...
INFO Generated signature: abc123def456...
```

---

### 8. Probar con Valores de Ejemplo de Wompi

Wompi proporciona ejemplos en su documentación. Prueba con estos valores:

```bash
curl -X POST http://localhost:8000/api/subscriptions/debug-signature/ \
  -H "Content-Type: application/json" \
  -d '{
    "amount_in_cents": 5000000,
    "currency": "COP",
    "reference": "TEST_REFERENCE_123"
  }'
```

Compara la firma generada con la documentación de Wompi.

---

### 9. Errores Comunes

#### ❌ Error: Integrity Key incorrecto
```python
# Incorrecto - usando la llave pública
WOMPI_INTEGRITY_KEY = 'pub_test_b3LGmVloYasfVNKpZOc5ND0MMyAgQxFG'

# Correcto - usando el integrity secret
WOMPI_INTEGRITY_KEY = 'test_integrity_0h9R8sLVKQd3khMyvveBwbS3Cchql6T9'
```

#### ❌ Error: Reference diferente
```javascript
// Backend recibe:
reference: "sub_cliente_123"

// Frontend envía a Wompi:
reference: "sub_cliente_456"  // ❌ DIFERENTE!

// Debe ser el mismo:
reference: "sub_cliente_123"  // ✅ CORRECTO
```

#### ❌ Error: Amount en formato incorrecto
```javascript
// Incorrecto - string
amount_in_cents: "2290000"

// Correcto - número
amount_in_cents: 2290000
```

#### ❌ Error: Espacios o separadores
```python
# Incorrecto
concatenated = f"{reference} {amount_in_cents} {currency} {integrity_key}"

# Correcto
concatenated = f"{reference}{amount_in_cents}{currency}{integrity_key}"
```

---

### 10. Solución Rápida

**Si nada funciona, prueba esto:**

1. **Copia el Integrity Secret exacto de Wompi:**
   ```
   Dashboard → Desarrolladores → Secretos → Integrity Secret
   ```

2. **Pégalo en settings.py:**
   ```python
   WOMPI_INTEGRITY_KEY = 'test_integrity_PEGA_AQUI_TU_CLAVE'
   ```

3. **Reinicia Django:**
   ```bash
   # Ctrl+C
   python manage.py runserver
   ```

4. **Prueba el endpoint de debug:**
   ```bash
   curl -X POST http://localhost:8000/api/subscriptions/debug-signature/ \
     -H "Content-Type: application/json" \
     -d '{"amount_in_cents": 2290000, "currency": "COP", "reference": "test_123"}'
   ```

5. **Copia el `concatenated_string` del response**

6. **Verifica en Python directamente:**
   ```python
   import hashlib
   
   concatenated = "PEGA_AQUI_EL_CONCATENATED_STRING"
   signature = hashlib.sha256(concatenated.encode()).hexdigest()
   print(signature)
   ```

7. **Compara con el signature del response** - deben ser iguales

---

### 11. Contactar Soporte de Wompi

Si después de todos estos pasos el error persiste:

1. Verifica que tu cuenta de Wompi esté activa
2. Verifica que tengas permisos para usar el Integrity Secret
3. Contacta a soporte de Wompi con:
   - Tu concatenated_string (sin el integrity key)
   - La firma generada
   - El error exacto que recibes

---

## 🔒 Seguridad

**⚠️ IMPORTANTE:** El endpoint `/api/subscriptions/debug-signature/` expone el Integrity Secret.

**Antes de ir a producción:**

1. **Eliminar o deshabilitar el endpoint de debug**
2. **Remover los logs detallados de la firma**
3. **Nunca compartir el Integrity Secret públicamente**

---

## 📞 Ayuda Adicional

Si el problema persiste, revisa:
- Documentación oficial de Wompi: https://docs.wompi.co/
- Logs del servidor Django
- Console del navegador (errores de CORS o red)
