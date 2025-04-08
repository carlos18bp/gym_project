<!-- ActivityFeed.vue -->
<template>
  <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4 h-full flex flex-col">
    <!-- Tabs navigation -->
    <div class="border-b border-gray-200">
      <div class="flex">
        <!-- Feed tab -->
        <div class="mr-8 text-center">
          <button 
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'feed' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'feed'"
          >
            Feed
          </button>
          <div v-if="activeTab === 'feed'" class="h-0.5 bg-blue-500 w-12 mx-auto mt-2"></div>
        </div>
        
        <!-- Contacts tab -->
        <div class="text-center">
          <button 
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'contacts' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'contacts'"
          >
            {{ isLawyer ? 'Contactos' : 'Abogados' }}
          </button>
          <div v-if="activeTab === 'contacts'" class="h-0.5 bg-blue-500 w-20 mx-auto mt-2"></div>
        </div>
      </div>
    </div>

    <!-- Feed content -->
    <div v-if="activeTab === 'feed'" class="mt-4 overflow-y-auto max-h-[170px] scrollbar-thin">
      <div class="timeline">
        <div 
          v-for="(activity, index) in activities" 
          :key="index" 
          class="timeline-item pb-6"
          :class="{'last-item': index === activities.length - 1}"
        >
          <div class="flex">
            <!-- Timeline icon with connector -->
            <div class="timeline-icon relative flex-shrink-0 mr-3" style="width: 40px;">
              <div 
                class="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white relative z-10"
                :class="[
                  getActivityIconClass(activity.type),
                  `border-${getActivityBorderColor(activity.type)}`
                ]"
              >
                <ArrowUpIcon v-if="activity.type === 'edit'" class="h-5 w-5 text-white" />
                <PlusIcon v-else-if="activity.type === 'create'" class="h-5 w-5 text-white" />
                <ArrowDownIcon v-else-if="activity.type === 'finish'" class="h-5 w-5 text-white" />
              </div>
              <!-- Timeline connector line -->
              <div 
                v-if="index < activities.length - 1" 
                class="timeline-connector w-0.5 top-10 h-full"
                :class="getActivityLineClass(activity.type)"
              ></div>
            </div>
            
            <!-- Content -->
            <div class="flex-grow pr-2 flex items-center">
              <div class="flex justify-between w-full">
                <p class="text-gray-500 pr-2 my-auto">{{ activity.description }}</p>
                <div class="text-gray-400 text-sm whitespace-nowrap flex-shrink-0 my-auto">{{ activity.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contacts/Lawyers content -->
    <div v-else class="mt-4 overflow-y-auto max-h-[170px] scrollbar-thin">
      <div v-if="!contacts.length" class="text-center text-gray-500 py-4">
        Cargando contactos...
      </div>
      <div v-for="(contact, index) in contacts" :key="index" class="flex items-center gap-4 pb-3 mb-3 border-b border-gray-100 last:border-b-0 last:mb-0">
        <div class="flex-shrink-0">
          <img 
            :src="contact.photo || '/default-avatar.jpg'" 
            :alt="contact.name"
            class="w-10 h-10 rounded-full object-cover"
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
  </div>
</template>

<script setup>
/**
 * Activity Feed Component
 * 
 * This component displays a feed of recent activities and a list of contacts.
 * If the user is a lawyer, they'll see "Contacts" with blue/orange dots.
 * If the user is a client, they'll see "Lawyers" with gray dots.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { ArrowUpIcon, ArrowDownIcon, PlusIcon } from '@heroicons/vue/24/outline';
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
const activeTab = ref('feed');
const userStore = useUserStore();
const activities = ref([]);
const contacts = ref([]);
const isDataLoaded = ref(false);

// Check if user is a lawyer
const isLawyer = computed(() => props.user?.role === 'lawyer');

// Function to get activity icon CSS class based on type
const getActivityIconClass = (type) => {
  switch (type) {
    case 'edit':
      return 'bg-blue-500';
    case 'create':
      return 'bg-green-500';
    case 'finish':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
};

// Function to get activity border color based on type
const getActivityBorderColor = (type) => {
  switch (type) {
    case 'edit':
      return 'blue-500';
    case 'create':
      return 'green-500';
    case 'finish':
      return 'blue-500';
    default:
      return 'gray-500';
  }
};

// Function to get timeline connector line color
const getActivityLineClass = (type) => {
  switch (type) {
    case 'edit':
      return 'bg-blue-300';
    case 'create':
      return 'bg-green-300';
    case 'finish':
      return 'bg-blue-300';
    default:
      return 'bg-gray-300';
  }
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
  await userStore.init();
  isDataLoaded.value = true;
  
  // Example activity data
  activities.value = [
    {
      type: 'edit',
      description: 'Editaste el proceso de alimentos de Jhonnatan Carmona.',
      time: 'Hace 13 horas'
    },
    {
      type: 'create',
      description: 'Creaste el nuevo contrato Arriendo 2025',
      time: 'Hace 1 día'
    },
    {
      type: 'finish',
      description: 'Finalizaste el proceso Laboral de Andrea Paez.',
      time: 'Hace 1 semana'
    },
    {
      type: 'finish',
      description: 'Finalizaste el proceso Laboral de Andrea Paez.',
      time: 'Hace 1 semana'
    }
  ];
  
  // Load contacts after data is loaded
  loadContacts();
});
</script>

<style scoped>
.timeline {
  position: relative;
  padding-left: 10px;
}

.timeline-item {
  position: relative;
}

.timeline-connector {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.timeline-item:last-child .timeline-connector {
  display: none;
}

.last-item .timeline-connector {
  display: none;
}

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
