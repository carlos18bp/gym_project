<template>
  <div class="px-4 py-6 sm:px-6 lg:px-8">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando datos...</span>
    </div>

    <!-- Error state for wrong user role -->
    <div v-else-if="!isValidRole" class="text-center py-12">
      <div class="mx-auto max-w-md">
        <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Acceso Restringido</h3>
        <p class="mt-1 text-sm text-gray-500">
          Esta vista es solo para clientes normales.
        </p>
        <p class="mt-2 text-xs text-gray-400">
          Tu rol actual: {{ userStore.currentUser?.role || 'Sin definir' }}
        </p>
      </div>
    </div>

    <!-- Main content -->
    <div v-else>
      <!-- Header -->
      <div class="mb-8">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-bold leading-6 text-gray-900">
              Mis Organizaciones
            </h1>
            <p class="mt-2 text-sm text-gray-700">
              Gestiona tus membresías, invitaciones y solicitudes corporativas
            </p>
          </div>
          
          <!-- Quick actions -->
          <div class="mt-4 sm:mt-0 flex space-x-3">
            <button
              v-if="myMemberships.length > 0"
              @click="openCreateRequestModal"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon class="h-4 w-4 mr-2" />
              Nueva Solicitud
            </button>
          </div>
        </div>
      </div>

      <!-- Organization Posts Section (for organizations the client is a member of) -->
      <div v-if="myMemberships.length > 0" class="mb-8">
        <div class="mb-6">
          <h2 class="text-lg font-medium text-gray-900">Anuncios de Organizaciones</h2>
          <p class="mt-1 text-sm text-gray-600">
            Información importante de las organizaciones donde eres miembro
          </p>
        </div>
        
        <div class="space-y-8">
          <div v-for="organization in myMemberships" :key="`posts-${organization.id}`">
            <!-- Organization Header -->
            <div class="bg-white shadow rounded-lg overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center space-x-4">
                  <img 
                    :src="organization.profile_image || '/src/assets/images/user_avatar.jpg'" 
                    :alt="`Logo de ${organization.title}`"
                    class="h-12 w-12 rounded-full object-cover bg-gray-100"
                  />
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900">{{ organization.title }}</h3>
                    <p class="text-sm text-gray-600">{{ organization.description }}</p>
                  </div>
                </div>
              </div>
              
              <!-- Posts Content -->
              <div class="px-6 py-4">
                <OrganizationPostsSection :organization-id="organization.id" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            <component :is="tab.icon" class="h-5 w-5 mr-2 inline" />
            {{ tab.name }}
            <span
              v-if="tab.count !== undefined"
              :class="[
                activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-900',
                'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium'
              ]"
            >
              {{ tab.count }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="space-y-6">
        <!-- Organizations Tab -->
        <div v-if="activeTab === 'organizations'">
          <OrganizationsSection
            :organizations="myMemberships"
            :is-loading="organizationsStore.isLoading"
            @organization-left="handleOrganizationLeft"
            @create-request="openCreateRequestModal"
          />
        </div>

        <!-- Requests Tab -->
        <div v-if="activeTab === 'requests'">
          <MyRequestsSection
            :requests="myRequests"
            :is-loading="requestsStore.isLoadingRequests"
            @request-detail="viewRequestDetail"
            @create-request="openCreateRequestModal"
          />
        </div>

        <!-- Invitations Tab -->
        <div v-if="activeTab === 'invitations'">
          <InvitationsSection
            :invitations="myInvitations"
            :is-loading="organizationsStore.isLoadingInvitations"
            @invitation-responded="handleInvitationResponded"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <CreateRequestModal
      :visible="showCreateRequestModal"
      :organizations="myMemberships"
      @close="closeCreateRequestModal"
      @created="handleRequestCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useOrganizationsStore } from '@/stores/organizations';
import { useCorporateRequestsStore } from '@/stores/corporate_requests';
import { useUserStore } from '@/stores/auth/user';

// Icons
import {
  EnvelopeIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  PlusIcon
} from '@heroicons/vue/24/outline';

// Components
import InvitationsSection from './sections/InvitationsSection.vue';
import OrganizationsSection from './sections/OrganizationsSection.vue';
import MyRequestsSection from './sections/MyRequestsSection.vue';
import CreateRequestModal from '../modals/CreateRequestModal.vue';
import OrganizationPostsSection from './sections/OrganizationPostsSection.vue';

// Stores
const organizationsStore = useOrganizationsStore();
const requestsStore = useCorporateRequestsStore();
const userStore = useUserStore();
const router = useRouter();

// Reactive state
const activeTab = ref('organizations');
const showCreateRequestModal = ref(false);

// Computed properties
const isLoading = computed(() => 
  organizationsStore.isLoading || requestsStore.isLoadingRequests
);
const isValidRole = computed(() => userStore.currentUser?.role === 'client' || userStore.currentUser?.role === 'basic');
const myInvitations = computed(() => organizationsStore.myInvitations);
const myMemberships = computed(() => organizationsStore.myMemberships);
const myRequests = computed(() => requestsStore.myRequests);

// Tabs configuration
const tabs = computed(() => [
  {
    id: 'organizations',
    name: 'Mis Organizaciones',
    icon: BuildingOfficeIcon,
    count: myMemberships.value.length
  },
  {
    id: 'requests',
    name: 'Mis Solicitudes',
    icon: ClipboardDocumentListIcon,
    count: myRequests.value.length
  },
  {
    id: 'invitations',
    name: 'Invitaciones',
    icon: EnvelopeIcon,
    count: myInvitations.value.filter(inv => inv.status === 'PENDING').length
  }
]);

// Methods
const loadData = async () => {
  try {
    // Verify user role before making requests
    const userRole = userStore.currentUser?.role;
    
    if (!userRole) {
      console.error('User role not available');
      return;
    }
    
    if (userRole !== 'client') {
      console.error('User is not a client, cannot load client dashboard data');
      return;
    }
    
    console.log('Loading client dashboard data...');
    
    await Promise.all([
      organizationsStore.getMyInvitations(),
      organizationsStore.getMyMemberships(),
      requestsStore.getMyRequests({ page_size: 50 })
    ]);
    
    console.log('Client dashboard data loaded successfully');
  } catch (error) {
    console.error('Error loading client dashboard data:', error);
    
    // Show user-friendly error message based on error type
    if (error.response?.status === 403) {
      console.error('Access denied. User may not have client permissions.');
    } else if (error.response?.status === 401) {
      console.error('Authentication error. User may need to log in again.');
    }
  }
};

// Modal handlers
const openCreateRequestModal = () => {
  showCreateRequestModal.value = true;
};

const closeCreateRequestModal = () => {
  showCreateRequestModal.value = false;
};

// Event handlers
const handleInvitationResponded = (invitationData) => {
  // Refresh invitations and memberships
  Promise.all([
    organizationsStore.getMyInvitations(),
    organizationsStore.getMyMemberships()
  ]);
};

const handleOrganizationLeft = (organizationId) => {
  // Refresh memberships
  organizationsStore.getMyMemberships();
};

const handleRequestCreated = (requestData) => {
  closeCreateRequestModal();
  // Refresh requests
  requestsStore.getMyRequests();
  // Switch to requests tab
  activeTab.value = 'requests';
};

const viewRequestDetail = (requestId) => {
  // Navigate to request detail
  router.push({
    name: 'organizations_dashboard',
    query: {
      tab: 'request-detail',
      id: requestId
    }
  });
};

// Lifecycle
onMounted(async () => {
  console.log('ClientDashboard mounted');
  
  // Ensure user store is initialized
  if (!userStore.currentUser) {
    console.log('Waiting for user data to be available...');
    await userStore.init();
  }
  
  // Double check user role
  const userRole = userStore.currentUser?.role;
  console.log('Current user role:', userRole);
  
  if (userRole === 'client') {
    loadData();
  } else {
    console.error('User does not have client role. Current role:', userRole);
  }
});
</script>
