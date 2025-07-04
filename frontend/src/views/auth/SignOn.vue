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
    >
      <h1 class="font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl">
        Te damos la bienvenida
      </h1>
      <div>
        <label for="email" class="block mb-2 text-sm font-medium text-gray-900">
          Correo electronico
        </label>
        <input
          v-model="userForm.email"
          type="email"
          id="email"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          required
        />
      </div>

      <div>
        <label
          for="password"
          class="block mb-2 text-sm font-medium text-gray-900"
        >
          Contraseña
        </label>
        <input
          v-model="userForm.password"
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
          v-model="userForm.confirmPassword"
          type="password"
          id="confirm_password"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
        />
      </div>

      <div class="grid md:grid-cols-2 md:gap-6 xl:space-y-0">
        <div>
          <label
            for="first_name"
            class="block mb-2 text-sm font-medium text-gray-900"
          >
            Nombre
          </label>
          <input
            v-model="userForm.firstName"
            type="text"
            id="first_name"
            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          />
        </div>
        <div>
          <label
            for="last_name"
            class="block mb-2 text-sm font-medium text-gray-900"
          >
            Apellido
          </label>
          <input
            v-model="userForm.lastName"
            type="text"
            id="last_name"
            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          />
        </div>
      </div>

      <div class="flex items-center mb-4">
        <input 
          id="privacy-policy" 
          type="checkbox" 
          v-model="privacyAccepted"
          class="w-4 h-4 text-secondary bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
        >
        <label for="privacy-policy" class="ml-2 text-sm font-medium text-gray-900">
          He leído y acepto las 
          <a 
            href="https://gymconsultoresjuridicos.com/politicas-de-privacidad-y-manejo-de-datos-personales/" 
            target="_blank"
            class="text-secondary hover:underline"
          >
            políticas de privacidad y manejo de datos personales
          </a>
        </label>
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

      <button
        v-if="!passcodeSent"
        @click.prevent="sendVerificationPasscode"
        type="submit"
        :disabled="!privacyAccepted"
        class="text-white bg-secondary hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Registrarse
      </button>

      <div v-if="passcodeSent" class="grid md:grid-cols-2 md:gap-6">
        <input
          v-model="passcode"
          type="text"
          id="passcode"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          placeholder="Código de verificación"
        />
        <button
          @click.prevent="signOnUser"
          type="submit"
          class="text-white bg-secondary hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center"
        >
          Verificar
        </button>
      </div>

      <div class="flex flex-col">
        <p class="font-regular">
          ¿Tienes una cuenta?
          <router-link
            :to="{ name: 'sign_in' }"
            class="font-regular text-secondary"
          >
            Iniciar sesión
          </router-link>
        </p>
        <div class="flex items-center w-full mt-4">
          <div class="flex-grow border-t border-gray-300"></div>
          <span class="mx-4 text-gray-500">O continuar con</span>
          <div class="flex-grow border-t border-gray-300"></div>
        </div>
        <div class="flex justify-center">
          <GoogleLogin 
            class="mt-6" 
            :callback="handleLoginWithGoogle" 
            select-account
            :auto-login="false"
          />
        </div>
      </div>

      <!--Terms and conditions and Privacy Policy -->
      <div
        class="w-full flex justify-around items-center text-center text-secondary font font-regular text-sm"
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
import axios from "axios";
import router from "@/router";
import { onMounted, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { loginWithGoogle } from "@/shared/login_with_google";
import { showNotification } from "@/shared/notification_message";
import VueRecaptcha from "vue3-recaptcha2";
import { useCaptchaStore } from "@/stores/captcha";

const authStore = useAuthStore(); // Get the authentication store instance
const captchaStore = useCaptchaStore();
const siteKey = ref(""); // will be fetched asynchronously

const captchaToken = ref("");
const onCaptchaVerified = async (token) => {
  const ok = await captchaStore.verify(token);
  if (ok) {
    captchaToken.value = token;
  } else {
    showNotification("Error verificando captcha", "error");
    captchaToken.value = "";
  }
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
const passcodeSent = ref("");
const emailUsedToSentPasscode = ref("");

onMounted(async () => {
  siteKey.value = await captchaStore.fetchSiteKey();
  if (await authStore.isAuthenticated()) {
    router.push({
      name: "dashboard",
      params: { user_id: userId, display: "" },
    });
  }
});

/**
 * Sends a verification passcode to the user's email.
 *
 * This function performs the following steps:
 * 1. Validates the input fields using the `checkInputs` function.
 * 2. Displays a notification indicating that an access code has been sent.
 * 3. Attempts to send a verification code to the provided email address via an API request.
 * 4. If successful, stores the passcode in the `passcodeSent` reactive variable.
 * 5. If the email is already registered (status code 409), displays an appropriate notification.
 * 6. Handles other errors by displaying a generic error notification.
 *
 * @async
 * @function sendVerificationPasscode
 * @throws Will display an error notification if the API request fails for any reason.
 */
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
  showNotification(
    "Se ha enviado un código de acceso a tu correo electrónico",
    "info"
  );
  try {
    emailUsedToSentPasscode.value = userForm.email;
    const response = await axios.post("/api/sign_on/send_verification_code/", {
      email: userForm.email,
      captcha_token: captchaToken.value,
    });

    passcodeSent.value = response.data.passcode;
  } catch (error) {
    console.error("Error during verification code process:", error);
    if (error.response && error.response.status === 409) {
      showNotification("El correo electrónico ya está registrado", "error");
    } else {
      showNotification("¡Error al enviar el código!", "error");
    }
  }
};

/**
 * Handles user sign on process
 */
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

  if (passcodeSent.value == passcode.value) {
    const response = await axios.post("/api/sign_on/", {
      email: emailUsedToSentPasscode.value,
      password: userForm.password,
      first_name: userForm.firstName,
      last_name: userForm.lastName,
      passcode: passcode.value,
      captcha_token: captchaToken.value,
    });
    authStore.login(response.data); // Log in the user

    showNotification("¡Inicio de sesión exitoso!", "success");
    router.push({
      name: "dashboard",
      params: {
        user_id: "",
        display: "",
      },
    }); // Redirect to dashboard
  } else {
    showNotification("El código no es válido", "warning");
  }
  try {
  } catch (error) {
    console.error("Error during sign on process:", error);
    showNotification("¡Fallo en el inicio de sesión!", "error");
  }
};

/**
 * Check input fields to avoid empty data
 */
const checkInputs = () => {
  if (!userForm.email) {
    showNotification("El correo electrónico es obligatorio", "warning");
    return;
  }
  if (!userForm.password) {
    showNotification("La contraseña es obligatoria", "warning");
    return;
  }
  if (!userForm.confirmPassword) {
    showNotification(
      "La confirmación de la contraseña es obligatoria",
      "warning"
    );
    return;
  }
  if (userForm.password !== userForm.confirmPassword) {
    showNotification("¡Las contraseñas no coinciden!", "warning");
    return;
  }
  if (userForm.password !== userForm.confirmPassword) {
    showNotification("¡Las contraseñas no coinciden!", "warning");
    return;
  }
};

/**
 * Handles login with Google response
 */
const handleLoginWithGoogle = (response) => {
  loginWithGoogle(response, router, authStore);
};
</script>
