<!-- ContactsWidget.vue -->
<template>
  <div class="overflow-y-auto max-h-[170px] scrollbar-thin">
    <div v-if="!contacts.length" class="text-center text-gray-500 py-4">
      Cargando contactos...
    </div>
    <div v-for="(contact, index) in contacts" :key="index" class="flex items-center gap-4 pb-3 mb-3 border-b border-gray-100 last:border-b-0 last:mb-0">
      <div class="flex-shrink-0">
        <img 
          :src="contact.photo || '@/assets/images/user_avatar.jpg'" 
          :alt="contact.name"
          class="w-10 h-10 rounded-full object-cover"
          @error="handleImageError"
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
import { ref, computed, onMounted, watch } from 'vue';
import { useUserStore } from '@/stores/user';

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
const isDataLoaded = ref(false);

// Check if user is a lawyer
const isLawyer = computed(() => props.user?.role === 'lawyer');

// Function to handle image loading errors
const handleImageError = (e) => {
  e.target.src = '/user_avatar.jpg';
};

// Function to load contacts based on user role
const loadContacts = () => {
  if (!isDataLoaded.value || !props.user?.id) return;
  
  if (isLawyer.value) {
    // For lawyers, show clients (orange dot) and other lawyers (blue dot)
    contacts.value = userStore.clientsAndLawyers
      .filter(u => u.id !== props.user.id)
      .map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        role: u.role,
        photo: u.photo_profile
      }));
  } else {
    // For clients, show only lawyers (gray dot)
    contacts.value = userStore.users
      .filter(u => u.role === 'lawyer')
      .map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        role: u.role,
        photo: u.photo_profile
      }));
  }
};

// Watch for changes in the user object and reload contacts
watch(() => props.user, (newUser) => {
  if (newUser?.id) {
    loadContacts();
  }
}, { deep: true });

// Initialize component data
onMounted(async () => {
  console.log('ContactsWidget mounted, user:', props.user);
  
  await userStore.init();
  isDataLoaded.value = true;
  
  // Load contacts after data is loaded
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