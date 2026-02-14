<template>
  <div class="relative xl:absolute">
    <div class="flex justify-start p-4">
      <img class="w-40 hidden xl:block" src="@/assets/images/logo/logo2.png" />
      <img class="w-20 block xl:hidden" src="@/assets/images/logo/logo1.png" />
    </div>
  </div>
  <section class="flex mt-6 justify-center xl:mt-0 xl:h-screen xl:items-center">
    <form
      class="space-y-5 px-8 w-full md:px-32 2xl:px-72 xl:w-1/2 2xl:w-2/3 order-2"
      @submit.prevent="handleResetPassword"
    >
      <h1 class="font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl">
        No te preocupes, vamos ayudarte
      </h1>

      <div class="grid">
        <div>
          <label
            for="email"
            class="block mb-2 text-sm font-medium text-gray-900"
          >
            Correo electronico
          </label>
          <input
            v-model="email"
            type="email"
            id="email"
            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            required
          />
        </div>
      </div>

      <div>
        <label
          for="passcode"
          class="block mb-2 text-sm font-medium text-gray-900"
        >
          Código de verificación
        </label>
        <input
          v-model="passcode"
          type="number"
          id="passcode"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
        />
        <button
          :class="{
            'text-sm font-medium text-secondary cursor-pointer flex items-center':
              !isButtonDisabled && !isLoadingSendCode,
            'text-sm font-medium text-gray-400 cursor-not-allowed flex items-center':
              isLoadingSendCode,
            hidden: isButtonDisabled && !isLoadingSendCode,
          }"
          @click.prevent="handleRequestPasswordReset"
          :disabled="isButtonDisabled || isLoadingSendCode"
        >
          <svg v-if="isLoadingSendCode" class="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoadingSendCode ? 'Enviando...' : 'Enviar código' }}
        </button>
        <div v-if="timer > 0" class="text-start text-sm mt-2 text-gray-600">
          <span class="font-regular">Enviar nuevo código en </span
          ><span class="font-bold">{{ timer }}</span>
          <span class="font-regular"> segundos.</span>
        </div>
      </div>

      <div>
        <label
          for="password"
          class="block mb-2 text-sm font-medium text-gray-900"
        >
          Contraseña
        </label>
        <input
          v-model="newPassword"
          type="password"
          id="password"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
        />
      </div>

      <div>
        <label
          for="confirm_password"
          class="block mb-2 text-sm font-medium text-gray-900"
        >
          Confirmar contraseña
        </label>
        <input
          v-model="confirmPassword"
          type="password"
          id="confirm_password"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
        />
      </div>

      <!-- Google captcha button -->
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

      <div class="grid">
        <button
          type="submit"
          :disabled="isLoadingReset"
          :class="{
            'w-full text-white bg-secondary hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center flex items-center justify-center':
              !isLoadingReset,
            'w-full text-white bg-gray-400 cursor-not-allowed font-medium rounded-lg text-sm px-5 py-2.5 text-center flex items-center justify-center':
              isLoadingReset,
          }"
        >
          <svg v-if="isLoadingReset" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoadingReset ? 'Restableciendo contraseña...' : 'Iniciar sesión' }}
        </button>
        <p class="w-full font-medium rounded-lg text-sm py-2.5 text-start">
          <span>¿Recordaste tu contraseña? </span>
          <RouterLink :to="{ name: 'sign_in' }">
            <span class="text-secondary">Iniciar sesión</span>
          </RouterLink>
        </p>
      </div>

      <div v-if="timer > 0" class="text-center mt-2 text-gray-600">
        Por favor espere <span class="font-bold">{{ timer }}</span> antes de
        enviar un nuevo código.
      </div>

      <!--Terms and conditions and Privacy Policy -->
      <div
        class="w-full py-12 flex justify-around items-center text-center text-secondary font font-regular text-sm"
      >
        <router-link :to="{ name: 'terms_of_use' }" class="cursor-pointer"
          >Condiciones de uso</router-link
        >
        <router-link :to="{ name: 'privacy_policy' }" class="cursor-pointer"
          >Aviso de privacidad</router-link
        >
      </div>
    </form>
    <div
      class="h-screen hidden overflow-hidden order-1 xl:w-1/2 2xl:w-1/3 xl:block"
    >
      <img
        src="@/assets/images/signIn/signIn.jpg"
        alt="illustration"
        class="w-full h-full object-cover"
      />
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { showNotification } from "@/shared/notification_message";
import VueRecaptcha from "vue3-recaptcha2";
import { useCaptchaStore } from "@/stores/auth/captcha";

const router = useRouter(); // Get the router instance
const email = ref(""); // A ref to store the email input
const passcode = ref(""); // A ref to store the passcode input
const newPassword = ref(""); // A ref to store the new password input
const confirmPassword = ref(""); // A ref to store the confirm password input
const timer = ref(0); // A ref to manage the countdown timer
const isButtonDisabled = ref(false); // A ref to manage the button disabled state
const isLoadingSendCode = ref(false); // Loading state for sending code
const isLoadingReset = ref(false); // Loading state for password reset

// reCAPTCHA v2 integration
const captchaStore = useCaptchaStore();
const siteKey = ref("");
const captchaToken = ref("");
const onCaptchaVerified = async (token) => {
  // Simply store the token without validating it here
  // The backend will validate it when the user submits the form
  captchaToken.value = token;
};
const onCaptchaExpired = () => {
  captchaToken.value = "";
};

onMounted(async () => {
  siteKey.value = await captchaStore.fetchSiteKey();
  // Restore timer if still running in localStorage
  if (parseInt(localStorage.getItem("forgetPasswordSecondsRemaining"), 10))
    startTimer();
});

/**
 * Handles the request to send a password reset passcode to the user's email
 */
const handleRequestPasswordReset = async () => {
  if (!email.value) {
    showNotification("Email is required!", "warning");
    return;
  }
  if (!captchaToken.value) {
    showNotification("Por favor verifica que no eres un robot", "warning");
    return;
  }

  if (isLoadingSendCode.value) {
    return;
  }

  isLoadingSendCode.value = true;
  try {
    await axios.post("/api/send_passcode/", {
      email: email.value,
      subject_email: "Password Reset Code",
      captcha_token: captchaToken.value,
    });

    showNotification("Código de restablecimiento enviado a tu correo", "info");
    startTimer(); // Start the countdown timer
  } catch (error) {
    console.error("Error when password reset is requested:", error);
    if (error.response && error.response.status === 400) {
      showNotification(error.response.data.error || "Error de validación", "error");
    } else {
      showNotification("Usuario no encontrado", "warning");
    }
  } finally {
    isLoadingSendCode.value = false;
  }
};

/**
 * Starts the countdown timer for the resend button
 */
const startTimer = () => {
  if (!parseInt(localStorage.getItem("forgetPasswordSecondsRemaining"), 10))
    localStorage.setItem("forgetPasswordSecondsRemaining", 180);

  isButtonDisabled.value = true;
  timer.value = parseInt(
    localStorage.getItem("forgetPasswordSecondsRemaining"),
    10
  );

  const interval = setInterval(() => {
    timer.value--;
    localStorage.setItem("forgetPasswordSecondsRemaining", timer.value);
    if (timer.value <= 0) {
      clearInterval(interval);
      isButtonDisabled.value = false;
      localStorage.removeItem("forgetPasswordSecondsRemaining");
    }
  }, 1000);
};

/**
 * Handles the password reset process
 */
const handleResetPassword = async () => {
  if (!passcode.value) {
    showNotification("Código es requerido!", "warning");
    return;
  }
  if (!newPassword.value) {
    showNotification("Nueva contraseña es requerida!", "warning");
    return;
  }
  if (!confirmPassword.value) {
    showNotification("Confirmar contraseña es requerido!", "warning");
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    showNotification("Las contraseñas no coinciden!", "warning");
    return;
  }
  if (!captchaToken.value) {
    showNotification("Por favor verifica que no eres un robot", "warning");
    return;
  }

  if (isLoadingReset.value) {
    return;
  }

  isLoadingReset.value = true;
  try {
    await axios.post("/api/verify_passcode_and_reset_password/", {
      passcode: passcode.value,
      new_password: newPassword.value,
      email: email.value,
      captcha_token: captchaToken.value,
    });

    showNotification("¡Contraseña restablecida exitosamente!", "success");
    router.push({ name: "sign_in" });
  } catch (error) {
    if (error.response && error.response.data) {
      showNotification(error.response.data.error, "error");
    } else {
      showNotification("Error al restablecer contraseña", "error");
    }
  } finally {
    isLoadingReset.value = false;
  }
};
</script>
