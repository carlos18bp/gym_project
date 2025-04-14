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
        Te damos la bienvenida de nuevo
      </h1>
      <div>
        <label for="email" class="block mb-2 text-sm font-medium text-gray-900">
          Correo electronico
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
        <label
          for="passcode"
          class="block mb-2 text-sm font-medium text-gray-900"
        >
          Código de verificación
        </label>
        <input
          v-model="userForm.passcode"
          type="number"
          id="passcode"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
        />
        <button
          :class="{
            'text-sm font-medium text-secondary cursor-pointer':
              !isButtonDisabled,
            hidden: isButtonDisabled,
          }"
          @click.prevent="handleSendPassword"
          :disabled="isButtonDisabled"
        >
          Enviar código
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
          v-model="userForm.password"
          type="password"
          id="password"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"
          placeholder=""
        />
        <a class="text-sm font-medium text-secondary">
          <RouterLink :to="{ name: 'forget_password' }">
            ¿Olvidaste tu contraseña?
          </RouterLink>
        </a>
      </div>

      <div class="flex flex-col space-y-2">
        <div>
          <button
            @click.prevent="signInUser"
            type="submit"
            :disabled="signInSecondsRemaining > 1"
            :class="{
              'w-full text-white bg-secondary hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center':
                signInSecondsRemaining < 1,
              'w-full text-white bg-gray-400 cursor-not-allowed font-medium rounded-lg text-sm px-5 py-2.5 text-center':
                signInSecondsRemaining >= 1,
            }"
          >
            Iniciar sesión
          </button>
          <div
            v-if="signInSecondsRemaining > 0"
            class="text-start text-sm mt-2 text-gray-600"
          >
            <span class="font-regular">Intentar de nuevo en </span
            ><span class="font-bold">{{ signInSecondsRemaining }}</span>
            <span class="font-regular"> segundos.</span>
          </div>
        </div>
        <p>
          <span class="font-regular">¿Nuevo en G&M?</span>
          <router-link
            :to="{ name: 'sign_on' }"
            class="font-regular text-secondary"
          >
            Registrarse.
          </router-link>
        </p>
      </div>

      <div class="flex flex-col items-center justify-center text-center">
        <div class="flex items-center w-full mx-4">
          <div class="flex-grow border-t border-gray-300"></div>
          <span class="mx-4 text-gray-500">O continuar con</span>
          <div class="flex-grow border-t border-gray-300"></div>
        </div>

        <GoogleLogin 
          class="mt-6" 
          :callback="handleLoginWithGoogle" 
          prompt="select_account"
          auto-login="false"
        />
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
import { useAuthStore } from "@/stores/auth";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { loginWithGoogle } from "@/shared/login_with_google";
import { showNotification } from "@/shared/notification_message";

const timer = ref(0); // A ref to manage the countdown timer for send a new code
const router = useRouter(); // Get the router instance
const authStore = useAuthStore(); // Get the authentication store instance
const isButtonDisabled = ref(false); // A ref to manage the button disabled state in Send Code
const signInTries = computed(() => authStore.signInTries); // A ref to count tries of Sign In
const signInSecondsRemaining = computed(() => authStore.signInSecondsRemaining); // A ref to seconds countdown for try again Sign In

const userForm = reactive({
  email: "",
  passcode: "",
  password: "",
});

onMounted(async () => {
  authStore.attempsSignIn("initial");

  if (await authStore.isAuthenticated()) {
    router.push({
      name: "dashboard",
      params: {
        user_id: "",
        display: "",
      },
    }); // Redirect to dashboard if already authenticated
  }
});

/**
 * Handles user sign in process
 */
const signInUser = async () => {
  if (!userForm.email) {
    showNotification("Email is required!", "warning");
    return;
  }

  authStore.attempsSignIn();

  if (signInTries.value % 3 === 0) {
    showNotification(
      "You have exceeded the maximum number of attempts. Please try again later.",
      "warning"
    );
  } else {
    try {
      const response = await axios.post("/api/sign_in/", userForm);
      authStore.login(response.data); // Log in the user

      showNotification("Sign In successful!", "success");
      // Reload the page to ensure a clean state
      window.location.href = "/dashboard";
    } catch (error) {
      if (error.response && error.response.status === 401) {
        showNotification("Invalid credentials!", "warning");
      } else {
        showNotification("Sign On failed!", "error");
      }
    }
  }
  userForm.passcode = "";
  userForm.password = "";
};

/**
 * Handles login with Google response
 */
const handleLoginWithGoogle = (response) => {
  loginWithGoogle(response, router, authStore);
};

/**
 * Handles sending password reset passcode to the user's email
 */
const handleSendPassword = async () => {
  if (!userForm.email) {
    showNotification("Email is required!", "warning");
    return;
  }
  startTimer(); // Start the countdown timer

  try {
    await axios.post("/api/send_passcode/", {
      email: userForm.email,
      subject_email: "Login code",
    });
    showNotification("Password code sent to your email", "info");
  } catch (error) {
    console.error("Error when code is sent:", error);
    showNotification("User not found", "warning");
  }
};

/**
 * Starts the countdown timer for the resend button
 */
const startTimer = () => {
  isButtonDisabled.value = true;
  timer.value = 180;

  const interval = setInterval(() => {
    timer.value--;
    if (timer.value <= 0) {
      clearInterval(interval);
      isButtonDisabled.value = false;
    }
  }, 1000);
};
</script>
