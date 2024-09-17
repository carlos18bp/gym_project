<template>
  <div class="absolute">
    <div class="flex justify-center p-4">
      <h2 class="font-bold text-xl">Project<br />App</h2>
    </div>
  </div>
  <section class="flex h-screen items-center">
    <form
      class="space-y-5 px-36 xl:w-1/2 2xl:w-1/3"
      @submit.prevent="handleResetPassword"
    >
      <h1 class="font-bold text-center xl:text-3xl 2xl:text-4xl">
        No worry, let's help you
      </h1>

      <div class="grid">
        <div>
          <label
            for="email"
            class="block mb-2 text-sm font-medium text-gray-900"
          >
            Email Address
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
          Verification Code
        </label>
        <input
          v-model="passcode"
          type="number"
          id="passcode"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
        />
        <button
          :class="{
            'text-sm font-medium text-blue-800 cursor-pointer':
              !isButtonDisabled,
            hidden: isButtonDisabled,
          }"
          @click.prevent="handleRequestPasswordReset"
          :disabled="isButtonDisabled"
        >
          Send Code
        </button>
        <div v-if="timer > 0" class="text-start text-sm mt-2 text-gray-600">
          <span class="font-regular">Send a new code in </span
          ><span class="font-bold">{{ timer }}</span>
          <span class="font-regular">seconds.</span>
        </div>
      </div>

      <div>
        <label
          for="password"
          class="block mb-2 text-sm font-medium text-gray-900"
        >
          Password
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
          Confirm Password
        </label>
        <input
          v-model="confirmPassword"
          type="password"
          id="confirm_password"
          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
        />
      </div>

      <div class="grid">
        <button
          type="submit"
          class="w-full text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
        >
          Sign In
        </button>
        <p class="w-full font-medium rounded-lg text-sm py-2.5 text-start">
          <span>Was a misclick? </span>
          <RouterLink :to="{ name: 'sign_in' }">
            <span class="text-blue-800">Go back</span>
          </RouterLink>
        </p>
      </div>

      <div v-if="timer > 0" class="text-center mt-2 text-gray-600">
        Please wait <span class="font-bold">{{ timer }}</span> seconds before
        requesting another code.
      </div>
    </form>
    <div class="h-screen xl:w-1/2 2xl:w-2/3 overflow-hidden">
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

const router = useRouter(); // Get the router instance
const email = ref(""); // A ref to store the email input
const passcode = ref(""); // A ref to store the passcode input
const newPassword = ref(""); // A ref to store the new password input
const confirmPassword = ref(""); // A ref to store the confirm password input
const timer = ref(0); // A ref to manage the countdown timer
const isButtonDisabled = ref(false); // A ref to manage the button disabled state

onMounted(() => {
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

  try {
    await axios.post("/api/send_passcode/", {
      email: email.value,
      subject_email: "Password Reset Code",
    });

    showNotification("Password reset code sent to your email", "info");
    startTimer(); // Start the countdown timer
  } catch (error) {
    console.error("Error when password reset is requested:", error);
    showNotification("User not found", "warning");
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
    showNotification("Passcode is required!", "warning");
    return;
  }
  if (!newPassword.value) {
    showNotification("New Password is required!", "warning");
    return;
  }
  if (!confirmPassword.value) {
    showNotification("Confirm Password is required!", "warning");
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    showNotification("Passwords do not match!", "warning");
    return;
  }

  try {
    await axios.post("/api/verify_passcode_and_reset_password/", {
      passcode: passcode.value,
      new_password: newPassword.value,
    });

    showNotification("Password reset successful!", "success");
    router.push({ name: "sign_in" });
  } catch (error) {
    showNotification(error.response.data.error, "error");
  }
};
</script>
