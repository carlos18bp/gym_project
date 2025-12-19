<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <button
            @click="goBack"
            class="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            <span class="text-sm font-medium">Volver a planes</span>
          </button>
          <h1 class="text-xl font-bold text-primary">Finalizar Suscripción</h1>
          <div class="w-24"></div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Plan Details - Left Side -->
        <div class="lg:col-span-2 space-y-6">
          <!-- User Info -->
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-primary mb-4">Información de contacto</h2>
            <div class="bg-terciary border border-stroke rounded-lg p-4">
              <div class="flex items-center gap-3">
                <div class="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-white font-semibold">
                  {{ userInitials }}
                </div>
                <div>
                  <p class="font-medium text-gray-900">{{ userStore.currentUser?.first_name }} {{ userStore.currentUser?.last_name }}</p>
                  <p class="text-sm text-gray-600">{{ userStore.currentUser?.email }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Plan Selected -->
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-primary mb-4">Plan seleccionado</h2>
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h3 class="text-xl font-bold" :class="planColor">{{ planDetails.name }}</h3>
                  <p class="text-sm text-gray-600 mt-1">{{ planDetails.description }}</p>
                </div>
                <div class="text-right">
                  <p class="text-2xl font-bold text-primary">{{ planDetails.price }}</p>
                  <p class="text-sm text-gray-500">{{ planDetails.billing }}</p>
                </div>
              </div>
              
              <!-- Key Features -->
              <div class="border-t border-gray-200 pt-4 mt-4">
                <p class="text-sm font-medium text-gray-700 mb-3">Características principales:</p>
                <div class="space-y-2">
                  <div v-for="(feature, index) in planDetails.keyFeatures" :key="index" class="flex items-start gap-2 text-sm text-gray-700">
                    <svg class="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>{{ feature }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Payment Method - Card Form + Wompi Tokenization -->
          <div v-if="planDetails.amountInCents > 0" class="bg-white rounded-xl border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-primary mb-4">Método de pago</h2>
            
            <!-- Payment Status -->
            <div v-if="!cardToken" class="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <div class="text-center mb-6">
                <svg class="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                </svg>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Configura tu método de pago</h3>
                <p class="text-sm text-gray-600">Ingresa los datos de tu tarjeta para continuar.</p>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del titular</label>
                  <input
                    v-model="cardHolder"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Como aparece en la tarjeta"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Número de tarjeta</label>
                  <input
                    v-model="cardNumber"
                    type="text"
                    inputmode="numeric"
                    autocomplete="cc-number"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="0000 0000 0000 0000"
                  />
                </div>

                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                    <input
                      v-model="cardExpMonth"
                      type="text"
                      inputmode="numeric"
                      maxlength="2"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                      placeholder="MM"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Año</label>
                    <input
                      v-model="cardExpYear"
                      type="text"
                      inputmode="numeric"
                      maxlength="2"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                      placeholder="AA"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                    <input
                      v-model="cardCvc"
                      type="password"
                      inputmode="numeric"
                      maxlength="4"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                      placeholder="CVC"
                    />
                  </div>
                </div>

                <button
                  @click="tokenizeCard"
                  :disabled="isSavingPaymentMethod"
                  :class="[
                    'w-full px-6 py-3 rounded-lg text-base font-semibold text-white transition-all duration-200',
                    isSavingPaymentMethod ? 'bg-gray-400 cursor-not-allowed' : 'bg-secondary hover:bg-blue-700'
                  ]"
                >
                  <span v-if="isSavingPaymentMethod" class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando método de pago...
                  </span>
                  <span v-else>
                    Guardar método de pago
                  </span>
                </button>
              </div>
            </div>

            <!-- Payment Method Added -->
            <div v-else class="border border-green-500 bg-green-50 rounded-lg p-6">
              <div class="flex items-start gap-3">
                <svg class="h-6 w-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div class="flex-1">
                  <p class="font-semibold text-green-900">Método de pago configurado</p>
                  <p class="text-sm text-green-700 mt-1">Tu método de pago ha sido guardado de forma segura</p>
                </div>
                <button
                  @click="clearSavedCard"
                  class="text-sm text-secondary hover:text-blue-700 font-medium"
                >
                  Cambiar
                </button>
              </div>
            </div>
            
            <!-- Info message -->
            <div class="mt-4 bg-terciary border border-stroke rounded-lg p-4">
              <div class="flex items-start gap-3">
                <svg class="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                <div>
                  <p class="text-sm font-medium text-gray-900">Pago seguro</p>
                  <p class="text-xs text-gray-600 mt-1">Tus datos están protegidos y encriptados por Wompi. No almacenamos información de tu tarjeta.</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Order Summary - Right Side -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
            <h2 class="text-lg font-semibold text-primary mb-4">Resumen del pedido</h2>
            
            <div class="space-y-3 mb-6">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ planDetails.name }}</span>
                <span class="font-medium text-gray-900">{{ planDetails.price }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Plan de {{ planDetails.duration }}</span>
                <span class="font-medium text-gray-900">{{ planDetails.billing }}</span>
              </div>
              
              <div class="border-t border-gray-200 pt-3 mt-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Subtotal</span>
                  <span class="text-sm font-medium text-gray-900">{{ planDetails.price }}</span>
                </div>
              </div>
              
              <div class="border-t border-gray-200 pt-3">
                <div class="flex justify-between">
                  <span class="font-semibold text-gray-900">Total a pagar hoy</span>
                  <span class="text-xl font-bold text-primary">{{ planDetails.price }}</span>
                </div>
              </div>
            </div>

            <button
              @click="handleSubscribe"
              :disabled="isProcessing || (planDetails.amountInCents > 0 && !cardToken)"
              :class="{
                'w-full px-6 py-3 bg-secondary rounded-lg text-base font-semibold text-white hover:bg-blue-700 transition-all duration-200 mb-4': !isProcessing && (planDetails.amountInCents === 0 || cardToken),
                'w-full px-6 py-3 bg-gray-400 rounded-lg text-base font-semibold text-white cursor-not-allowed mb-4': isProcessing || (planDetails.amountInCents > 0 && !cardToken)
              }"
            >
              <span v-if="isProcessing" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
              <span v-else>
                {{ planDetails.amountInCents === 0 ? 'Activar Plan Gratuito' : 'Confirmar Suscripción' }}
              </span>
            </button>

            <div class="text-center">
              <div class="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
                <svg class="h-4 w-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                <span>Pago seguro y protegido</span>
              </div>
              <p class="text-xs text-gray-500">30 días de garantía de reembolso</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/auth/user';
import { useSubscriptionStore } from '@/stores/subscriptions';
import Swal from 'sweetalert2';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const subscriptionStore = useSubscriptionStore();

const planType = ref(route.params.plan);
const isProcessing = ref(false);
const wompiPublicKey = ref(null);

// Card tokenization state
const cardNumber = ref('');
const cardExpMonth = ref('');
const cardExpYear = ref('');
const cardCvc = ref('');
const cardHolder = ref('');
const cardToken = ref(null);
const wompiSessionId = ref(null);
const isSavingPaymentMethod = ref(false);

const planDetails = computed(() => {
  const plans = {
    basico: {
      name: 'Plan Básico',
      description: 'Personas con necesidades legales básicas',
      price: 'Gratuito',
      billing: '/mes',
      duration: '48 meses',
      color: 'text-primary',
      amountInCents: 0,
      keyFeatures: [
        'Consulta Procesos Judiciales',
        '+100 Documentos Jurídicos',
        'Firma Electrónica (solo recibe)',
      ]
    },
    cliente: {
      name: 'Plan Cliente',
      description: 'Clientes individuales o emprendedores',
      price: '$22,900 COP',
      billing: '/mes',
      duration: '48 meses',
      color: 'text-secondary',
      amountInCents: 2290000, // $22,900 COP in cents
      keyFeatures: [
        '+500 Documentos Premium',
        'Membrete Personalizado',
        'Firma Electrónica completa',
        'Envío ilimitado de documentos',
        '3 docs personalizados incluidos',
        '2h consultoría mensual',
      ]
    },
    corporativo: {
      name: 'Plan Corporativo',
      description: 'Empresas, pymes y organizaciones',
      price: '$550,000 COP',
      billing: '/mes',
      duration: '48 meses',
      color: 'text-primary',
      amountInCents: 55000000, // $550,000 COP in cents
      keyFeatures: [
        '+1000 Docs Premium y Corporativos',
        'Usuarios Vinculados',
        'Módulo de Organizaciones',
        '5 docs de alta complejidad',
        '10 revisiones mensuales',
        '10h consultoría mensual',
      ]
    }
  };

  return plans[planType.value] || plans.basico;
});

const planColor = computed(() => planDetails.value.color);

const userInitials = computed(() => {
  const firstName = userStore.currentUser?.first_name || '';
  const lastName = userStore.currentUser?.last_name || '';
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
});

const goBack = () => {
  router.push({ name: 'subscriptions' });
};

const loadWompiScript = () => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('wompi-widget-script')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const loadWompiJs = () => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('wompi-js-script')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'wompi-js-script';
    script.src = 'https://wompijs.wompi.com/libs/js/v1.js';
    script.async = true;
    if (wompiPublicKey.value) {
      script.dataset.publicKey = wompiPublicKey.value;
    }
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const tokenizeCard = async () => {
  if (isSavingPaymentMethod.value) return;

  if (!cardNumber.value || !cardExpMonth.value || !cardExpYear.value || !cardCvc.value) {
    await Swal.fire({
      title: 'Información incompleta',
      text: 'Por favor, completa todos los campos de la tarjeta.',
      icon: 'warning',
      confirmButtonColor: '#3348FF',
    });
    return;
  }

  if (!wompiPublicKey.value) {
    await Swal.fire({
      title: 'Error',
      text: 'No se pudo cargar la configuración de pagos. Por favor, recarga la página.',
      icon: 'error',
      confirmButtonColor: '#3348FF',
    });
    return;
  }

  isSavingPaymentMethod.value = true;

  try {
    const payload = {
      number: cardNumber.value.replace(/\s+/g, ''),
      cvc: cardCvc.value,
      exp_month: cardExpMonth.value,
      exp_year: cardExpYear.value,
      card_holder:
        cardHolder.value || `${userStore.currentUser?.first_name || ''} ${userStore.currentUser?.last_name || ''}`.trim(),
    };

    const response = await axios.post('https://sandbox.wompi.co/v1/tokens/cards', payload, {
      headers: {
        Authorization: `Bearer ${wompiPublicKey.value}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data && response.data.status === 'CREATED' && response.data.data?.id) {
      cardToken.value = response.data.data.id;

      await Swal.fire({
        title: '¡Método de pago agregado!',
        text: 'Tu método de pago ha sido configurado exitosamente.',
        icon: 'success',
        confirmButtonColor: '#3348FF',
        timer: 2000,
      });
    } else {
      throw new Error('Respuesta inesperada al tokenizar la tarjeta');
    }
  } catch (error) {
    await Swal.fire({
      title: 'Error',
      text:
        error.response?.data?.error ||
        'No se pudo guardar tu método de pago. Por favor, intenta nuevamente.',
      icon: 'error',
      confirmButtonColor: '#3348FF',
    });
  } finally {
    isSavingPaymentMethod.value = false;
  }
};

const clearSavedCard = () => {
  cardToken.value = null;
  cardNumber.value = '';
  cardExpMonth.value = '';
  cardExpYear.value = '';
  cardCvc.value = '';
  cardHolder.value = '';
};

const openWompiWidget = async () => {
  try {
    await loadWompiScript();

    // Wait for Wompi to be available
    if (typeof window.WidgetCheckout === 'undefined') {
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo cargar el sistema de pagos. Por favor, recarga la página.',
        icon: 'error',
        confirmButtonColor: '#3348FF',
      });
      return;
    }

    // Generate reference
    const reference = `sub_${planType.value}_${Date.now()}`;

    // Get integrity signature from backend
    const signature = await subscriptionStore.generateWompiSignature({
      amount_in_cents: planDetails.value.amountInCents,
      currency: 'COP',
      reference: reference,
    });

    const checkout = new window.WidgetCheckout({
      currency: 'COP',
      amountInCents: planDetails.value.amountInCents,
      reference: reference,
      publicKey: wompiPublicKey.value,
      'signature:integrity': signature,
      customerData: {
        email: userStore.currentUser?.email,
        fullName: `${userStore.currentUser?.first_name} ${userStore.currentUser?.last_name}`,
      },
    });

    checkout.open((result) => {
      const transaction = result && result.transaction ? result.transaction : null;

      // Usamos el sessionId de la transacción aprobada como "token" para crear el payment source en el backend
      if (transaction && transaction.status === 'APPROVED' && transaction.sessionId) {
        paymentSourceId.value = transaction.sessionId;
        Swal.fire({
          title: '¡Método de pago agregado!',
          text: 'Tu método de pago ha sido configurado exitosamente.',
          icon: 'success',
          confirmButtonColor: '#3348FF',
          timer: 2000,
        });
      } else {
        Swal.fire({
          title: 'Pago no completado',
          text: 'No se pudo agregar el método de pago. Por favor, intenta nuevamente.',
          icon: 'error',
          confirmButtonColor: '#3348FF',
        });
      }
    });
  } catch (error) {
    await Swal.fire({
      title: 'Error',
      text: error.response?.data?.error || 'No se pudo abrir el sistema de pagos. Por favor, intenta nuevamente.',
      icon: 'error',
      confirmButtonColor: '#3348FF',
    });
  }
};

const handleSubscribe = async () => {
  if (isProcessing.value) return;

  // Free plan - no payment needed
  if (planDetails.value.amountInCents === 0) {
    isProcessing.value = true;
    try {
      await subscriptionStore.createSubscription({
        plan_type: planType.value,
      });

      await Swal.fire({
        title: '¡Suscripción Activada!',
        text: 'Tu plan gratuito ha sido activado exitosamente.',
        icon: 'success',
        confirmButtonColor: '#3348FF',
      });

      router.push({ name: 'dashboard' });
    } catch (error) {
      await Swal.fire({
        title: 'Error',
        text: error.response?.data?.error || 'No se pudo activar tu suscripción. Por favor, intenta nuevamente.',
        icon: 'error',
        confirmButtonColor: '#3348FF',
      });
    } finally {
      isProcessing.value = false;
    }
    return;
  }

  // Paid plan - need payment source
  if (!cardToken.value) {
    await Swal.fire({
      title: 'Método de pago requerido',
      text: 'Por favor, completa la información de pago antes de continuar.',
      icon: 'warning',
      confirmButtonColor: '#3348FF',
    });
    return;
  }

  if (!wompiSessionId.value) {
    await Swal.fire({
      title: 'Error',
      text: 'No se pudo inicializar la sesión de pago. Por favor, recarga la página e intenta nuevamente.',
      icon: 'error',
      confirmButtonColor: '#3348FF',
    });
    return;
  }

  isProcessing.value = true;
  try {
    await subscriptionStore.createSubscription({
      plan_type: planType.value,
      session_id: wompiSessionId.value,
      token: cardToken.value,
    });

    await Swal.fire({
      title: '¡Suscripción Creada!',
      text: 'Tu suscripción ha sido activada exitosamente. Se realizará el primer cobro ahora.',
      icon: 'success',
      confirmButtonColor: '#3348FF',
    });

    router.push({ name: 'dashboard' });
  } catch (error) {
    await Swal.fire({
      title: 'Error',
      text: error.response?.data?.error || 'No se pudo crear tu suscripción. Por favor, intenta nuevamente.',
      icon: 'error',
      confirmButtonColor: '#3348FF',
    });
  } finally {
    isProcessing.value = false;
  }
};

onMounted(async () => {
  // Ensure user store is initialized
  if (!userStore.currentUser) {
    await userStore.init();
  }

  // Get Wompi public key from backend and pre-load script for paid plans
  if (planDetails.value.amountInCents > 0) {
    try {
      wompiPublicKey.value = await subscriptionStore.fetchWompiPublicKey();
      await loadWompiScript();

      await loadWompiJs();

      if (window.$wompi && !wompiSessionId.value) {
        window.$wompi.initialize((data, error) => {
          if (error === null) {
            wompiSessionId.value = data.sessionId;
          }
        });
      }
    } catch (error) {
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo cargar la configuración de pagos. Por favor, recarga la página.',
        icon: 'error',
        confirmButtonColor: '#3348FF',
      });
    }
  }
});
</script>
