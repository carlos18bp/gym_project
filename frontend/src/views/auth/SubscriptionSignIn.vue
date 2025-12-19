<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img class="mx-auto h-16 w-auto" src="@/assets/images/logo/logo2.png" alt="G&M Abogados" />
        <h2 class="mt-6 text-3xl font-bold text-primary">
          Inicia sesión para continuar
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Accede a tu cuenta para completar tu suscripción
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <form class="space-y-6" @submit.prevent="signInUser">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-900 mb-2">
              Correo electrónico
            </label>
            <input
              v-model="userForm.email"
              type="email"
              id="email"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
              required
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-900 mb-2">
              Contraseña
            </label>
            <input
              v-model="userForm.password"
              type="password"
              id="password"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
              required
            />
            <router-link
              :to="{ name: 'forget_password' }"
              class="text-sm font-medium text-secondary hover:text-blue-700 mt-2 inline-block"
            >
              ¿Olvidaste tu contraseña?
            </router-link>
          </div>

          <!-- Google captcha -->
          <div>
            <VueRecaptcha
              v-if="siteKey"
              :sitekey="siteKey"
              @verify="onCaptchaVerified"
              @expire="onCaptchaExpired"
              hl="es"
              class="mx-auto"
            />
          </div>

          <div>
            <button
              type="submit"
              :disabled="signInSecondsRemaining > 1 || isLoading"
              :class="{
                'w-full text-white bg-secondary hover:bg-blue-700 font-semibold rounded-lg text-sm px-5 py-3 text-center flex items-center justify-center transition-colors':
                  signInSecondsRemaining < 1 && !isLoading,
                'w-full text-white bg-gray-400 cursor-not-allowed font-semibold rounded-lg text-sm px-5 py-3 text-center flex items-center justify-center':
                  signInSecondsRemaining >= 1 || isLoading,
              }"
            >
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? 'Validando credenciales...' : 'Iniciar sesión' }}
            </button>
            <div
              v-if="signInSecondsRemaining > 0"
              class="text-center text-sm mt-2 text-gray-600"
            >
              <span class="font-regular">Intentar de nuevo en </span>
              <span class="font-bold">{{ signInSecondsRemaining }}</span>
              <span class="font-regular"> segundos.</span>
            </div>
          </div>

          <div class="text-center">
            <p class="text-sm text-gray-600">
              ¿No tienes cuenta?
              <router-link
                :to="{ name: 'subscription_sign_up', query: { plan: $route.query.plan } }"
                class="font-medium text-secondary hover:text-blue-700"
              >
                Regístrate aquí
              </router-link>
            </p>
          </div>
        </form>

        <!-- Divider -->
        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">O continuar con</span>
            </div>
          </div>

          <div class="mt-6 flex justify-center">
            <GoogleLogin 
              :callback="handleLoginWithGoogle" 
              select-account
              :auto-login="false"
            />
          </div>
        </div>
      </div>

      <!-- Back to plans -->
      <div class="mt-6 text-center">
        <router-link
          :to="{ name: 'subscriptions' }"
          class="text-sm text-gray-600 hover:text-primary flex items-center justify-center gap-2"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Volver a planes
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from "axios";
import { useAuthStore } from "@/stores/auth/auth";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { loginWithGoogle } from "@/shared/login_with_google";
import { showNotification } from "@/shared/notification_message";
import VueRecaptcha from "vue3-recaptcha2";
import { useCaptchaStore } from "@/stores/auth/captcha";
import { decodeCredential } from "vue3-google-login";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const captchaStore = useCaptchaStore();
const siteKey = ref("");

const captchaToken = ref("");
const onCaptchaVerified = async (token) => {
  captchaToken.value = token;
};
const onCaptchaExpired = () => {
  captchaToken.value = "";
};

const signInTries = computed(() => authStore.signInTries);
const signInSecondsRemaining = computed(() => authStore.signInSecondsRemaining);
const isLoading = ref(false);

const userForm = reactive({
  email: "",
  password: "",
});

onMounted(async () => {
  authStore.attempsSignIn("initial");
  siteKey.value = await captchaStore.fetchSiteKey();

  // If already authenticated, redirect to checkout
  if (await authStore.isAuthenticated()) {
    const plan = route.query.plan || 'basico';
    router.push({ name: 'checkout', params: { plan } });
  }
});

const signInUser = async () => {
  if (!userForm.email) {
    showNotification("El correo electrónico es requerido", "warning");
    return;
  }
  if (!userForm.password) {
    showNotification("La contraseña es requerida", "warning");
    return;
  }
  if (!captchaToken.value) {
    showNotification("Por favor verifica que no eres un robot", "warning");
    return;
  }
  
  if (isLoading.value) {
    return;
  }
  
  authStore.attempsSignIn();

  if (signInTries.value % 3 === 0) {
    showNotification(
      "Has excedido el número máximo de intentos. Intenta más tarde.",
      "warning"
    );
  } else {
    isLoading.value = true;
    try {
      const response = await axios.post("/api/sign_in/", {
        email: userForm.email,
        password: userForm.password,
        captcha_token: captchaToken.value,
      });
      authStore.login(response.data);

      showNotification("¡Inicio de sesión exitoso!", "success");
      
      // Redirect to checkout with the plan
      const plan = route.query.plan || 'basico';
      router.push({ name: 'checkout', params: { plan } });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        showNotification("Credenciales inválidas", "warning");
      } else if (error.response && error.response.status === 400) {
        showNotification(error.response.data.error || "Error de validación", "error");
      } else {
        showNotification("Error en el inicio de sesión", "error");
      }
    } finally {
      isLoading.value = false;
    }
  }
  userForm.password = "";
};

const handleLoginWithGoogle = async (response) => {
  // Custom handler that redirects to checkout instead of dashboard
  try {
    const decodedCredential = decodeCredential(response.credential);

    const res = await axios.post("/api/google_login/", {
      email: decodedCredential.email,
      given_name: decodedCredential.given_name,
      family_name: decodedCredential.family_name,
      picture: decodedCredential.picture,
    });
    
    authStore.login(res.data);
    showNotification("¡Inicio de sesión exitoso con Google!", "success");
    
    const plan = route.query.plan || 'basico';
    router.push({ name: 'checkout', params: { plan } });
  } catch (error) {
    showNotification("Error al iniciar sesión con Google", "error");
  }
};
</script>
