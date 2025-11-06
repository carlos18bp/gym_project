<!-- UserWelcomeCard.vue -->
<template>
  <div class="rounded-xl w-full bg-gradient-to-r from-[#639CFF] to-[#BEB3FF] p-4 sm:p-6">
    <!-- Flex layout with responsive column arrangement -->
    <div class="flex flex-col gap-4 sm:gap-6">
      <!-- First row: welcome title -->
      <div class="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
        {{ welcomeMessage }}, {{ user?.first_name || 'Usuario' }}!
      </div>

      <!-- Second row: Avatar + Stats cards - stacked until 1450px, horizontal from there -->
      <div class="flex flex-col 2xl:flex-row gap-4 sm:gap-6 2xl:items-center">
        <!-- Avatar - centered on mobile with edit button -->
        <div class="flex-shrink-0 w-full 2xl:w-auto flex justify-center 2xl:justify-start">
          <div class="relative">
            <img 
              :src="user?.photo_profile || defaultAvatarUrl" 
              :alt="user?.first_name"
              class="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-white"
            />
            <!-- Edit button with pencil icon -->
            <button
              @click="openPhotoEditor"
              class="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors border-2 border-blue-500"
              title="Editar foto de perfil"
            >
              <PencilIcon class="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </button>
          </div>
        </div>

        <!-- Stats cards - stacked below avatar until 1450px, then horizontal -->
        <div class="flex flex-row justify-center 2xl:justify-start gap-4 w-full 2xl:ml-4">
          <!-- Membership date -->
          <div class="bg-white rounded-lg p-3 sm:p-4 flex flex-col items-center w-1/2 2xl:w-40 h-auto sm:h-32 md:h-40">
            <div class="text-blue-500 mb-1 sm:mb-2">
              <CalendarDaysIcon class="w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
            </div>
            <div class="text-blue-500 text-xl sm:text-2xl font-bold text-center">
              {{ formattedDate }}
            </div>
            <div class="text-gray-500 text-xs sm:text-sm text-center mt-auto truncate w-full">
              Miembro desde
            </div>
          </div>
      
          <!-- Active processes -->
          <div class="bg-white rounded-lg p-3 sm:p-4 flex flex-col items-center w-1/2 2xl:w-40 h-auto sm:h-32 md:h-40">
            <div class="text-blue-500 mb-1 sm:mb-2">
              <RectangleStackIcon class="w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
            </div>
            <div class="text-blue-500 text-4xl sm:text-5xl font-bold text-center">
              {{ activeProcesses }}
            </div>
            <div class="text-gray-500 text-xs sm:text-sm text-center mt-auto truncate w-full">
              Procesos activos
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
  
<script setup>
/**
 * User welcome card component
 * 
 * This component displays a welcome card for the logged-in user
 * with their avatar, name, membership date, and active processes count.
 * The background features a horizontal linear gradient from #639CFF to #BEB3FF.
 * Uses Heroicons Outline: calendar-days for membership date and rectangle-stack for active processes.
 * 
 * Fully responsive:
 * - On mobile: Elements stack vertically with centered alignment
 * - On tablets and up: Horizontal layout with properly sized elements
 */
import { computed, onMounted, ref } from 'vue';
import { RectangleStackIcon, CalendarDaysIcon, PencilIcon } from '@heroicons/vue/24/outline';
import { useProcessStore } from '@/stores/process';
import { useUserStore } from '@/stores/auth/user';
import { showNotification } from '@/shared/notification_message';
import defaultAvatarUrl from "@/assets/images/user_avatar.jpg";

// Props for customization
const props = defineProps({
  /**
   * User object containing user information
   */
  user: {
    type: Object,
    default: () => ({})
  },
  /**
   * Number of active processes
   */
  activeProcesses: {
    type: Number,
    default: 0
  }
});

const processStore = useProcessStore();
const userStore = useUserStore();
const fileInput = ref(null);

// Gender-neutral welcome messages
const welcomeMessages = [
  "De vuelta al trabajo",
  "Hola de nuevo",
  "Un placer verte",
  "¡Qué bueno tenerte aquí",
  "Excelente día",
  "¡Buen momento para avanzar",
  "Listo para continuar",
  "Proyecto en marcha",
  "Sesión iniciada",
  "Espacio de trabajo listo"
];

// Randomly select a welcome message
const getRandomMessage = () => {
  const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
  return welcomeMessages[randomIndex];
};

// Set the welcome message
const welcomeMessage = computed(() => {
  // With a 60% chance, use time-based greetings
  if (Math.random() < 0.6) {
    // Get the hour of the day
    const hour = new Date().getHours();
    
    // Time-specific greetings
    if (hour >= 5 && hour < 12) {
      return "Buenos días";
    } else if (hour >= 12 && hour < 19) {
      return "Buenas tardes";
    } else if ((hour >= 19 && hour <= 23) || (hour >= 0 && hour < 5)) {
      return "Buenas noches";
    }
  }
  
  // 40% chance to show a random project-themed message
  return getRandomMessage();
});

// Format date for display
const formattedDate = computed(() => {
  if (!props.user?.created_at) return '';
  
  const date = new Date(props.user.created_at);
  const month = date.toLocaleString('default', { month: 'short' });
  // Capitalize the first letter of the month
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${capitalizedMonth} ${day}, ${year}`;
});

// Initialize process store when component mounts
onMounted(async () => {
  await processStore.init();
});

// Get active processes count
const activeProcesses = computed(() => {
  return processStore.activeProcessesForCurrentUser.length;
});

/**
 * Opens the file input dialog for selecting a new profile photo
 */
const openPhotoEditor = () => {
  // Create a temporary file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = handleFileChange;
  input.click();
};

/**
 * Handles file selection and updates the user's profile picture
 * @param {Event} event - The file input change event
 */
const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      // Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      
      // Update the preview in the UI immediately
      if (props.user) {
        props.user.photo_profile = previewUrl;
      }
      
      // Create a temporary user object with the new photo
      const updatedUser = {
        ...props.user,
        photo_profile: file,
        photo_profile_preview: previewUrl
      };
      
      // Update the user profile with the new photo
      await userStore.updateUser(updatedUser);
      
      showNotification('Foto de perfil actualizada correctamente', 'success');
      
      // Refresh user data to get the updated photo URL from the server
      // This will update the store and propagate to all components
      const refreshedUser = await userStore.getUserInfo();
      
      // Update the prop with the new photo URL from server
      if (refreshedUser && refreshedUser.photo_profile) {
        props.user.photo_profile = refreshedUser.photo_profile;
      }
      
      // Clean up the preview URL after a delay to ensure the new image is loaded
      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
      }, 1000);
    } catch (error) {
      console.error('Error updating profile photo:', error);
      showNotification('Error al actualizar la foto de perfil', 'error');
    }
  }
};
</script>