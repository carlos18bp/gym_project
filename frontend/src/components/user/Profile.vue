<template>
  <!-- Container modal -->
  <div
    ref="modalContent"
    class="fixed inset-0 z-50 h-screen w-screen bg-gray-400 bg-opacity-40 backdrop-blur-md flex justify-center items-center"
    v-if="visible"
  >
    <!-- Modal container -->
    <div id="viewProfileModal" class="w-1/2 bg-white rounded-xl">
      <!-- Profile photo container -->
      <div>
        <div
          class="relative w-full h-52 rounded-t-xl"
          style="
            background-image: linear-gradient(
              to right,
              #3b82f6,
              #6366f1,
              #8b5cf6,
              #a855f7
            );
          "
        >
          <div class="absolute top-0 right-0 p-8">
            <XMarkIcon
              class="h-7 w-7 text-white font-semibold cursor-pointer"
              @click="closeModal()"
            >
            </XMarkIcon>
          </div>
          <div
            class="absolute bottom-0 left-0 -mb-16 ml-8 w-40 h-40 rounded-full border-4 border-white overflow-hidden flex justify-center items-center"
          >
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80"
              class="w-full h-full object-cover"
            />
          </div>
        </div>
        <div class="w-full h-20"></div>
      </div>
      <!-- Content container -->
      <div>
        <!-- Main information -->
        <div class="p-8 border-b border-gray-300">
          <h2 class="text-2xl font-semibold text-primary">Mary Jackson</h2>
          <p class="text-lg font-regular text-gray-500">
            Email: masdasd@gmail.com
          </p>
          <p class="text-lg font-regular text-gray-500">
            Telefono: 315 237 1666
          </p>
        </div>
        <!-- Secondary information -->
        <div class="p-8 mt-6">
          <h2 class="text-xl font-semibold text-primary">Acerca de mi</h2>
          <div class="grid gap-1">
            <p
              class="text-lg font-regular text-gray-500 flex items-center gap-2"
            >
              <ClockIcon class="h-5 w-5"></ClockIcon>
              <span>Fecha de nacimiento: 15/07/2006</span>
            </p>
            <p
              class="text-lg font-regular text-gray-500 flex items-center gap-2"
            >
              <DocumentArrowUpIcon class="h-5 w-5"></DocumentArrowUpIcon>
              <span>Cédula de ciudadania: 1.021.513.348</span>
            </p>
            <p
              class="text-lg font-regular text-gray-500 flex items-center gap-2"
            >
              <HeartIcon class="h-5 w-5"></HeartIcon>
              <span>Estado civil: Casado/a</span>
            </p>
          </div>
        </div>
        <!-- Button edit -->
        <div class="p-8">
          <button
            type="button"
            class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
            @click="goToEditProfile"
          >
            <span class="hidden lg:block">Editar</span>
          </button>
        </div>
      </div>
    </div>
    <!-- Edit profile -->
    <div
      id="editProfileModal"
      class="w-1/2 p-8 bg-white rounded-xl fixed left-full"
    >
      <!-- Navigation button -->
      <div>
        <!-- Come back button -->
        <button @click="goToProfile">
          <ChevronLeftIcon
            class="-ml-5 -mt-4 w-7 h-7 text-primary"
          ></ChevronLeftIcon>
        </button>
      </div>
      <h1 class="mt-4 text-2xl font-semibold text-primary">Editar perfil</h1>
      <!-- Main information -->

      <div class="mt-4 grid grid-cols-2 gap-3">
        <!-- First name form -->
        <div>
          <label
            for="firstName"
            class="block text-base font-medium leading-6 text-primary"
          >
            Nombre
            <span class="text-red-500">*</span>
          </label>
          <div class="mt-2">
            <input
              type="text"
              name="firstName"
              id="firstName"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              required
            />
          </div>
        </div>
        <!-- Last name form -->
        <div>
          <label
            for="lastName"
            class="block text-base font-medium leading-6 text-primary"
          >
            Apellido
            <span class="text-red-500">*</span>
          </label>
          <div class="mt-2">
            <input
              type="text"
              name="lastName"
              id="lastName"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              required
            />
          </div>
        </div>
        <!-- Contact form -->
        <div>
          <label
            for="contact"
            class="block text-base font-medium leading-6 text-primary"
          >
            Telefono
            <span class="text-red-500">*</span>
          </label>
          <div class="relative mt-2 rounded-md shadow-sm">
            <div class="absolute inset-y-0 left-0 flex items-center">
              <label for="country" class="sr-only">Colombia</label>
              <select
                disabled
                id="country"
                name="country"
                autocomplete="country"
                class="h-full rounded-md border-0 bg-transparent py-0 pl-3 pr-7 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
              >
                <option>CO</option>
              </select>
            </div>
            <input
              type="text"
              name="phone-number"
              id="phone-number"
              class="block w-full rounded-md border-0 py-1.5 pl-16 text-primary ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder="+57 315 237 1666"
            />
          </div>
        </div>
        <!-- Profile picture form -->
        <div>
          <div class="col-span-full">
            <label
              for="photo"
              class="block text-base font-medium leading-6 text-primary"
              >Foto</label
            >
            <div class="flex items-center gap-x-3">
              <UserCircleIcon
                class="h-12 w-12 text-gray-300"
                aria-hidden="true"
              />
              <button
                type="button"
                class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-primary shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cambiar
              </button>
            </div>
          </div>
        </div>
        <!-- Contact form -->
        <div>
          <label
            for="contact"
            class="block text-base font-medium leading-6 text-primary"
          >
            Correo electronico
            <span class="text-red-500">*</span>
          </label>
          <div class="relative mt-2 rounded-md shadow-sm">
            <div
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
            >
              <EnvelopeIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="email"
              name="email"
              id="email"
              class="block w-full rounded-md border-0 py-1.5 pl-10 text-primary ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <!-- Date of birth form -->
        <div>
          <label
            for="dob"
            class="block text-base font-medium leading-6 text-primary"
          >
            Fecha de Nacimiento
            <span class="text-red-500">*</span>
          </label>
          <div class="mt-2">
            <input
              type="date"
              name="dob"
              id="dob"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              required
            />
          </div>
        </div>
        <!-- National ID form -->
        <div>
          <label
            for="idNumber"
            class="block text-base font-medium leading-6 text-primary"
          >
            Número de Cédula
            <span class="text-red-500">*</span>
          </label>
          <div class="mt-2">
            <input
              type="number"
              name="idNumber"
              id="idNumber"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              required
            />
          </div>
        </div>
        <!-- Civil Status form -->
        <div>
          <label
            for="civilStatus"
            class="block text-base font-medium leading-6 text-primary"
          >
            Estado Civil
            <span class="text-red-500">*</span>
          </label>
          <select
            id="civilStatus"
            name="civilStatus"
            class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-primary ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            <option>Soltero</option>
            <option>Casado</option>
          </select>
        </div>
      </div>
      <!-- Button edit -->
      <div class="mt-4">
        <button
          type="button"
          class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
          @click="goToProfile"
        >
          <span class="hidden lg:block">Guardar</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Importing Heroicons and GSAP
 * @heroicons/vue - Used for adding SVG icons.
 * @gsap - Library for handling animations.
 */
import {
  ClockIcon,
  DocumentArrowUpIcon,
  HeartIcon,
  XMarkIcon,
  ChevronLeftIcon,
} from "@heroicons/vue/24/outline";
import { UserCircleIcon, EnvelopeIcon } from "@heroicons/vue/24/solid";
import { gsap } from "gsap";
import { watch, ref, nextTick } from "vue";

/**
 * Props:
 * @prop {Boolean} visible - Controls whether the modal is visible or not.
 */
const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
});

/**
 * Emits:
 * @event update:visible - Emitted to change the modal's visibility state.
 */
const emit = defineEmits(["update:visible"]);

/**
 * Ref:
 * @ref modalContent - Reference to the modal content to apply GSAP animations.
 */
const modalContent = ref(null);

/**
 * Watcher:
 * Watches for changes in the `visible` prop. If `true`, 
 * waits for the DOM to fully render using `nextTick` 
 * and then applies a fade-in animation from 0 to 1 opacity.
 *
 * @param {Boolean} newVal - The new value of the `visible` prop.
 */
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick(); // Ensures the DOM is fully updated before animating
      gsap.fromTo(
        modalContent.value,
        { opacity: 0 },
        { opacity: 1, duration: 0.5 } // Entry animation (fade-in)
      );
    }
  }
);

/**
 * closeModal:
 * Closes the modal by applying a fade-out animation 
 * and then emits `update:visible` with `false` to hide the modal.
 */
const closeModal = () => {
  gsap.to(modalContent.value, {
    opacity: 0,
    duration: 0.5,
    onComplete: () => {
      emit("update:visible", false); // Hides the modal after the animation completes
    },
  });
};

/**
 * goToEditProfile:
 * Slides the profile view and edit profile modal to the left (-150%) 
 * to switch views inside the modal.
 */
const goToEditProfile = () => {
  gsap.to(["#viewProfileModal", "#editProfileModal"], {
    x: "-150%",
    duration: 0.5,
  });
};

/**
 * goToProfile:
 * Slides both modals back to their original position (0%) 
 * to display the profile view.
 */
const goToProfile = () => {
  gsap.to(["#viewProfileModal", "#editProfileModal"], {
    x: "0%",
    duration: 0.5,
  });
};
</script>
