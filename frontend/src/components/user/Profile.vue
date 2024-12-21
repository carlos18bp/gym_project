<template>
  <!-- Container modal -->
  <div
    ref="modalContent"
    class="fixed inset-0 z-50 h-screen w-screen bg-gray-400 bg-opacity-40 backdrop-blur-md"
    v-if="visible"
  > 
    <!-- Modal profile container -->
    <div 
      id="viewProfileModal" 
      class="absolute w-full h-full px-4 flex justify-center items-center"
    >
      <div class="w-full xl:w-1/2 bg-white rounded-xl">
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
            <div v-if="currentUser.is_profile_completed"
              class="absolute top-0 right-0 p-8">
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
                :src="currentUser.photo_profile || userAvatar"
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
            <h2 class="text-2xl font-semibold text-primary">
              {{ currentUser.first_name }} {{ currentUser.last_name }}
              <span class="text-gray-400">
                ({{ currentUser.role == "client" ? "Cliente" : "Abogado" }})
              </span>
            </h2>
            <p class="text-lg font-regular text-gray-500">
              Email: {{ currentUser.email }}
            </p>
            <p class="text-lg font-regular text-gray-500">
              Telefono: {{ currentUser.contact }}
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
                <span>Fecha de nacimiento: {{ currentUser.birthday }}</span>
              </p>
              <p
                class="text-lg font-regular text-gray-500 flex items-center gap-2"
              >
                <DocumentArrowUpIcon class="h-5 w-5"></DocumentArrowUpIcon>
                <span
                  >Cédula de ciudadania: {{ currentUser.identification }}</span
                >
              </p>
              <p
                class="text-lg font-regular text-gray-500 flex items-center gap-2"
              >
                <HeartIcon class="h-5 w-5"></HeartIcon>
                <span>Estado civil: {{ currentUser.marital_status }}</span>
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
              <span v-if="currentUser.is_profile_completed" class="block">Editar</span>
              <span v-else class="block">Completa tu perfil</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Edit profile -->
    <div 
      id="editProfileModal" 
      class="absolute w-full h-full px-4 flex justify-center items-center left-full"
    >
      <div
        class="w-full xl:w-1/2 p-8 bg-white rounded-xl"
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
  
        <div class="mt-4 grid md:grid-cols-2 gap-3">
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
                v-model="currentUser.first_name"
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
                v-model="currentUser.last_name"
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
            <div class="mt-2 rounded-md shadow-sm">
              <input
                v-model="currentUser.contact"
                type="text"
                name="phone-number"
                id="phone-number"
                class="w-full rounded-md border-0 py-1.5 text-primary ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
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
              >
                Foto de perfil
              </label>
              <div class="flex items-center gap-x-3">
                <img
                  :src="currentUser.photo_profile_preview || currentUser.photo_profile || userAvatar"
                  alt="User Avatar"
                  class="h-12 w-12 rounded-full object-cover"
                />
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileChange"
                />
                <button
                  type="button"
                  @click="triggerFileInput"
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
                v-model="currentUser.email"
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
                v-model="currentUser.birthday"
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
                v-model="currentUser.identification"
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
              for="civil-status"
              class="block text-base font-medium leading-6 text-primary"
            >
              Estado Civil
              <span class="text-red-500">*</span>
            </label>
            <select
              v-model="currentUser.marital_status"
              id="civil-status"
              name="civil-status"
              class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-primary ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
            >
              <option value="Single">Soltero(a)</option>
              <option value="Married">Casado(a)</option>
              <option value="Divorced">Divorciado(a)</option>
              <option value="Domestic Partnership">Unión libre</option>
              <option value="Widowed">Viudo(a)</option>
            </select>
          </div>
        </div>
        <!-- Button edit -->
        <div class="mt-4">
          <button
            type="button"
            class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
            @click="updateUserProfile"
          >
            <span class="block">Guardar</span>
          </button>
        </div>
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
import { EnvelopeIcon } from "@heroicons/vue/24/solid";
import { gsap } from "gsap";
import { watch, ref, nextTick } from "vue";
import { useUserStore } from "@/stores/user";
import userAvatar from "@/assets/images/user_avatar.jpg";
import { showNotification } from "@/shared/notification_message";

const userStore = useUserStore();

/**
 * Props:
 * @prop {Boolean} visible - Controls whether the modal is visible or not.
 */
const props = defineProps({
  currentUser: {
    type: Object,
    required: true,
  },
  visible: {
    type: Boolean,
    required: true,
  },
});

const fileInput = ref(null);

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    const fileURL = URL.createObjectURL(file);
    props.currentUser.photo_profile = file;
    props.currentUser.photo_profile_preview = fileURL;
  }
};

const updateUserProfile = async () => {

  if (!props.currentUser.email) {
    showNotification("Email es requerido!", "warning");
    return;
  }

  if (!props.currentUser.first_name) {
    showNotification("El nombre es requerido!", "warning");
    return;
  }

  if (!props.currentUser.last_name) {
    showNotification("El apellido es requerido!", "warning");
    return;
  }

  if (!props.currentUser.contact) {
    showNotification("Un numero de contacto es requerido!", "warning");
    return;
  }

  if (!props.currentUser.birthday) {
    showNotification("Una fecha de nacimiento es requerido!", "warning");
    return;
  }

  if (!props.currentUser.identification) {
    showNotification("Numero de cedula es requerido!", "warning");
    return;
  }

  if (!props.currentUser.marital_status) {
    showNotification("Estado civil es requerido!", "warning");
    return;
  }

  await userStore.updateUser(props.currentUser);
  props.currentUser.photo_profile = props.currentUser.photo_profile_preview
  goToProfile();
  props.currentUser.is_profile_completed = true;
};

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
    x: "-100%",
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
