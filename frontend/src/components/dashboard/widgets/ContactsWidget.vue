<!-- ContactsWidget.vue -->
<template>
  <div class="overflow-y-auto max-h-[170px] scrollbar-thin">
    <div v-if="loading" class="text-center text-gray-500 py-4">
      Cargando contactos...
    </div>
    <div v-else-if="!contacts.length" class="text-center text-gray-500 py-4">
      No hay contactos disponibles.
    </div>
    <div 
      v-for="contact in contacts" 
      :key="contact.id" 
      class="flex items-center gap-4 pb-3 mb-3 border-b border-gray-100 last:border-b-0 last:mb-0"
    >
      <div class="flex-shrink-0 w-10 h-10 overflow-hidden rounded-full bg-gray-100">
        <div v-if="imageLoading[contact.id]" class="w-full h-full flex items-center justify-center">
          <!-- Placeholder mientras carga -->
          <div class="w-6 h-6 rounded-full bg-gray-200"></div>
        </div>
        <img 
          v-show="!imageLoading[contact.id]"
          :src="contact.photo || defaultAvatarUrl" 
          :alt="contact.name"
          class="w-10 h-10 object-cover"
          @error="handleImageError(contact.id)"
          @load="handleImageLoaded(contact.id)"
        />
      </div>
      <div class="flex-grow">
        <div class="flex items-center">
          <p class="font-medium text-gray-900">{{ contact.name }}</p>
          <span 
            class="mx-2 h-1.5 w-1.5 rounded-full"
            :class="{'bg-blue-500': !isLawyer || (isLawyer && contact.role === 'lawyer'), 'bg-orange-500': isLawyer && contact.role === 'client'}"
          ></span>
          <p class="text-gray-500 truncate">{{ contact.email }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Contacts Widget Component
 * 
 * This component displays a list of contacts or lawyers depending on the user role.
 * If the user is a lawyer, they'll see "Contacts" with blue/orange dots.
 * If the user is a client, they'll see "Lawyers" with gray dots.
 */
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import defaultAvatarUrl from "@/assets/images/user_avatar.jpg";

const props = defineProps({
  /**
   * Current user object
   */
  user: {
    type: Object,
    required: true
  }
});

// Component state
const userStore = useUserStore();
const contacts = ref([]);
const loading = ref(true);
const imageLoading = ref({});

// Check if user is a lawyer
const isLawyer = computed(() => props.user?.role === 'lawyer');

// Function to handle image loading errors
const handleImageError = (contactId) => {
  imageLoading.value[contactId] = false;
  // Buscar y actualizar la foto en el contacto
  const contactIndex = contacts.value.findIndex(c => c.id === contactId);
  if (contactIndex !== -1) {
    contacts.value[contactIndex].photo = defaultAvatarUrl;
  }
};

// Function to handle image loaded event
const handleImageLoaded = (contactId) => {
  imageLoading.value[contactId] = false;
};

// Function to load contacts based on user role
const loadContacts = async () => {
  loading.value = true;
  
  try {
    if (!props.user?.id) {
      loading.value = false;
      return;
    }
    
    // Make sure user store is initialized
    if (!userStore.isInitialized) {
      await userStore.init();
    }
    
    let userList = [];
    
    if (isLawyer.value) {
      // For lawyers, show clients (orange dot) and other lawyers (blue dot)
      userList = userStore.clientsAndLawyers
        .filter(u => u.id !== props.user.id)
        .map(u => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
          role: u.role,
          photo: u.photo_profile || null
        }));
    } else {
      // For clients, show only lawyers (gray dot)
      userList = userStore.users
        .filter(u => u.role === 'lawyer')
        .map(u => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
          role: u.role,
          photo: u.photo_profile || null
        }));
    }
    
    // Inicializar el estado de carga para cada imagen
    const newImageLoading = {};
    userList.forEach(contact => {
      newImageLoading[contact.id] = true;
    });
    
    imageLoading.value = newImageLoading;
    contacts.value = userList;
  } catch (error) {
    console.error('Error loading contacts:', error);
  } finally {
    loading.value = false;
  }
};

// Initialize component data
onMounted(() => {
  loadContacts();
});
</script>

<style scoped>
/* Custom scrollbar styles */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style> 