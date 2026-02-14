<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img class="mx-auto h-16 w-auto" src="@/assets/images/logo/logo2.png" alt="G&M Abogados" />
        <h2 class="mt-6 text-3xl font-bold text-primary">
          Crea tu cuenta
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Regístrate para completar tu suscripción
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <form class="space-y-6">
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

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="first_name" class="block text-sm font-medium text-gray-900 mb-2">
                Nombre
              </label>
              <input
                v-model="userForm.firstName"
                type="text"
                id="first_name"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
                required
              />
            </div>
            <div>
              <label for="last_name" class="block text-sm font-medium text-gray-900 mb-2">
                Apellido
              </label>
              <input
                v-model="userForm.lastName"
                type="text"
                id="last_name"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
                required
              />
            </div>
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
          </div>

          <div>
            <label for="confirm_password" class="block text-sm font-medium text-gray-900 mb-2">
              Confirmar contraseña
            </label>
            <input
              v-model="userForm.confirmPassword"
              type="password"
              id="confirm_password"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
              required
            />
          </div>

          <div class="flex items-start">
            <input 
              id="privacy-policy" 
              type="checkbox" 
              v-model="privacyAccepted"
              class="w-4 h-4 text-secondary bg-gray-100 border-gray-300 rounded focus:ring-secondary mt-1"
            >
            <label for="privacy-policy" class="ml-2 text-sm text-gray-700">
              He leído y acepto las 
              <a 
                href="https://gymconsultoresjuridicos.com/politicas-de-privacidad-y-manejo-de-datos-personales/" 
                target="_blank"
                class="text-secondary hover:underline font-medium"
              >
                políticas de privacidad y manejo de datos personales
              </a>
            </label>
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

          <div v-if="!passcodeSent">
            <button
              @click.prevent="sendVerificationPasscode"
              type="submit"
              :disabled="!privacyAccepted"
              class="w-full text-white bg-secondary hover:bg-blue-700 font-semibold rounded-lg text-sm px-5 py-3 text-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Registrarse
            </button>
          </div>

          <div v-if="passcodeSent" class="space-y-4">
            <div>
              <label for="passcode" class="block text-sm font-medium text-gray-900 mb-2">
                Código de verificación
              </label>
              <input
                v-model="passcode"
                type="text"
                id="passcode"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
                placeholder="Ingresa el código enviado a tu correo"
              />
            </div>
            <button
              @click.prevent="signOnUser"
              type="submit"
              class="w-full text-white bg-secondary hover:bg-blue-700 font-semibold rounded-lg text-sm px-5 py-3 text-center transition-colors"
            >
              Verificar y crear cuenta
            </button>
          </div>

          <div class="text-center">
            <p class="text-sm text-gray-600">
              ¿Ya tienes cuenta?
              <router-link
                :to="{ name: 'subscription_sign_in', query: { plan: $route.query.plan } }"
                class="font-medium text-secondary hover:text-blue-700"
              >
                Inicia sesión aquí
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
import { onMounted, reactive, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth/auth";
import { showNotification } from "@/shared/notification_message";
import VueRecaptcha from "vue3-recaptcha2";
import { useCaptchaStore } from "@/stores/auth/captcha";

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

const privacyAccepted = ref(false);

const userForm = reactive({
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  confirmPassword: "",
});

const passcode = ref("");
const passcodeSent = ref(false);
const emailUsedToSentPasscode = ref("");

onMounted(async () => {
  siteKey.value = await captchaStore.fetchSiteKey();
  
  // If already authenticated, redirect to checkout
  if (await authStore.isAuthenticated()) {
    const plan = route.query.plan || 'basico';
    router.push({ name: 'checkout', params: { plan } });
  }
});

const sendVerificationPasscode = async () => {
  checkInputs();
  if (!privacyAccepted.value) {
    showNotification("Debes aceptar las políticas de privacidad", "warning");
    return;
  }
  if (!captchaToken.value) {
    showNotification("Por favor verifica que no eres un robot", "warning");
    return;
  }
  
  try {
    emailUsedToSentPasscode.value = userForm.email;
    await axios.post("/api/sign_on/send_verification_code/", {
      email: userForm.email,
      captcha_token: captchaToken.value,
    });

    passcodeSent.value = true;
    showNotification(
      "Se ha enviado un código de acceso a tu correo electrónico",
      "info"
    );
  } catch (error) {
    console.error("Error during verification code process:", error);
    if (error.response && error.response.status === 409) {
      showNotification("El correo electrónico ya está registrado", "error");
    } else if (error.response && error.response.data && error.response.data.error) {
      showNotification(error.response.data.error, "error");
    } else {
      showNotification("Error al enviar el código", "error");
    }
  }
};

const signOnUser = async () => {
  checkInputs();
  if (emailUsedToSentPasscode.value !== userForm.email) {
    showNotification(
      "Has cambiado el correo electrónico de verificación, tendrás que generar un nuevo código nuevamente",
      "warning"
    );
    return;
  }
  if (!captchaToken.value) {
    showNotification("Por favor verifica que no eres un robot", "warning");
    return;
  }
  if (!passcode.value) {
    showNotification("El código de verificación es obligatorio", "warning");
    return;
  }

  try {
    const response = await axios.post("/api/sign_on/", {
      email: emailUsedToSentPasscode.value,
      password: userForm.password,
      first_name: userForm.firstName,
      last_name: userForm.lastName,
      passcode: passcode.value,
      captcha_token: captchaToken.value,
    });
    authStore.login(response.data);

    showNotification("¡Registro exitoso!", "success");
    
    // Redirect to checkout with the plan
    const plan = route.query.plan || 'basico';
    router.push({ name: 'checkout', params: { plan } });
  } catch (error) {
    console.error("Error during sign on process:", error);
    if (error.response && error.response.data && error.response.data.error) {
      const errMsg = Array.isArray(error.response.data.error)
        ? error.response.data.error.join(" ")
        : error.response.data.error;
      showNotification(errMsg, "error");
    } else {
      showNotification("Error en el registro", "error");
    }
  }
};

const checkInputs = () => {
  if (!userForm.email) {
    showNotification("El correo electrónico es obligatorio", "warning");
    throw new Error("Email required");
  }
  if (!userForm.firstName) {
    showNotification("El nombre es obligatorio", "warning");
    throw new Error("First name required");
  }
  if (!userForm.lastName) {
    showNotification("El apellido es obligatorio", "warning");
    throw new Error("Last name required");
  }
  if (!userForm.password) {
    showNotification("La contraseña es obligatoria", "warning");
    throw new Error("Password required");
  }
  if (!userForm.confirmPassword) {
    showNotification("La confirmación de la contraseña es obligatoria", "warning");
    throw new Error("Confirm password required");
  }
  if (userForm.password !== userForm.confirmPassword) {
    showNotification("Las contraseñas no coinciden", "warning");
    throw new Error("Passwords don't match");
  }
};

const handleLoginWithGoogle = async (response) => {
  try {
    const res = await axios.post("/api/google_login/", {
      credential: response.credential,
    });
    
    authStore.login(res.data);
    showNotification("¡Registro exitoso con Google!", "success");
    
    const plan = route.query.plan || 'basico';
    router.push({ name: 'checkout', params: { plan } });
  } catch (error) {
    showNotification("Error al registrarse con Google", "error");
  }
};
</script>
