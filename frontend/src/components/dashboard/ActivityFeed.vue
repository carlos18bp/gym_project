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
      <div v-if="activityFeedStore.loading" class="text-center py-4">
        <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500 border-r-2 border-gray-200 mr-2"></div>
        Cargando actividades...
      </div>
      <div v-else-if="activityFeedStore.error" class="text-center text-red-500 py-4">
        Error al cargar las actividades
      </div>
      <div v-else-if="!activityFeedStore.activities.length" class="text-center text-gray-500 py-4">
        No hay actividades registradas
      </div>
      <div v-else class="timeline">
        <div 
          v-for="(activity, index) in activityFeedStore.activities" 
          :key="activity.id || index" 
          class="timeline-item pb-6"
          :class="{'last-item': index === activityFeedStore.activities.length - 1}"
        >
          <div class="flex">
            <!-- Timeline icon with connector -->
            <div class="timeline-icon relative flex-shrink-0 mr-3" style="width: 40px;">
              <div 
                class="w-10 h-10 rounded-full flex items-center justify-center border-2 relative z-10"
                :class="[
                  getActivityIconClass(activity.type),
                  getBorderColorClass(activity.type)
                ]"
              >
                <PlusIcon v-if="activity.type === 'create'" class="h-5 w-5 text-green-500" />
                <PencilIcon v-else-if="activity.type === 'edit'" class="h-5 w-5 text-blue-500" />
                <ArrowDownIcon v-else-if="activity.type === 'finish'" class="h-5 w-5 text-indigo-500" />
                <TrashIcon v-else-if="activity.type === 'delete'" class="h-5 w-5 text-red-500" />
                <ArrowUpIcon v-else-if="activity.type === 'update'" class="h-5 w-5 text-yellow-500" />
                <QuestionMarkCircleIcon v-else class="h-5 w-5 text-gray-500" />
              </div>
              <!-- Timeline connector line -->
              <div 
                v-if="index < activityFeedStore.activities.length - 1" 
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
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  QuestionMarkCircleIcon 
} from '@heroicons/vue/24/outline';
import { useUserStore } from '@/stores/user';
import { useActivityFeedStore } from '@/stores/activity_feed';

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
const activityFeedStore = useActivityFeedStore();
const contacts = ref([]);
const isDataLoaded = ref(false);

// Check if user is a lawyer
const isLawyer = computed(() => props.user?.role === 'lawyer');

// Function to handle image loading errors
const handleImageError = (e) => {
  e.target.src = '/user_avatar.jpg';
};

// Function to get activity border color class
const getBorderColorClass = (type) => {
  switch (type) {
    case 'create':
      return 'border-green-500';
    case 'edit':
      return 'border-blue-500';
    case 'finish':
      return 'border-indigo-500';
    case 'delete':
      return 'border-red-500';
    case 'update':
      return 'border-yellow-500';
    case 'other':
    default:
      return 'border-gray-500';
  }
};

// Function to get activity icon CSS class based on type
const getActivityIconClass = (type) => {
  switch (type) {
    case 'create':
      return 'bg-green-200';
    case 'edit':
      return 'bg-blue-200';
    case 'finish':
      return 'bg-indigo-200';
    case 'delete':
      return 'bg-red-200';
    case 'update':
      return 'bg-yellow-200';
    case 'other':
    default:
      return 'bg-gray-200';
  }
};

// Function that returns the border color value, not used for classes
const getActivityBorderColor = (type) => {
  switch (type) {
    case 'create':
      return 'green-500';
    case 'edit':
      return 'blue-500';
    case 'finish':
      return 'indigo-500';
    case 'delete':
      return 'red-500';
    case 'update':
      return 'yellow-500';
    case 'other':
    default:
      return 'gray-500';
  }
};

// Function to get timeline connector line color
const getActivityLineClass = (type) => {
  switch (type) {
    case 'create':
      return 'bg-green-300';
    case 'edit':
      return 'bg-blue-300';
    case 'finish':
      return 'bg-indigo-300';
    case 'delete':
      return 'bg-red-300';
    case 'update':
      return 'bg-yellow-300';
    case 'other':
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
  console.log('ActivityFeed mounted, user:', props.user);
  
  await userStore.init();
  isDataLoaded.value = true;
  
  // Load contacts after data is loaded
  loadContacts();
  
  // Fetch user activities - try to fetch even if no user ID
  console.log('Fetching activities, user ID:', props.user?.id);
  await activityFeedStore.fetchUserActivities();
  
  // Log the result after fetching
  console.log('Activities loaded:', activityFeedStore.activities.length, activityFeedStore.activities);
});

// Add a watcher to debug activities changes
watch(() => activityFeedStore.activities, (newActivities) => {
  console.log('Activities updated:', newActivities.length, newActivities);
}, { deep: true });
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
