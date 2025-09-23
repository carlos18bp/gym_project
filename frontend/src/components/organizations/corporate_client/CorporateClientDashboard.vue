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
          Este dashboard es solo para clientes corporativos.
        </p>
        <p class="mt-2 text-xs text-gray-400">
          Tu rol actual: {{ userStore.currentUser?.role || 'Sin definir' }}
        </p>
      </div>
    </div>

    <!-- Main content -->
    <div v-else>
      <!-- Header with stats -->
      <div class="mb-8">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-bold leading-6 text-gray-900">
              Panel Corporativo
            </h1>
            <p class="mt-2 text-sm text-gray-700">
              Gestiona tus organizaciones y solicitudes corporativas
            </p>
          </div>
        </div>
      </div>


        <!-- Statistics cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <BuildingOfficeIcon class="h-6 w-6 text-gray-400" />
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Organizaciones
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {{ organizationStats.total_organizations }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <UsersIcon class="h-6 w-6 text-gray-400" />
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Miembros Totales
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {{ organizationStats.total_members }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <EnvelopeIcon class="h-6 w-6 text-gray-400" />
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Invitaciones Pendientes
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {{ organizationStats.total_pending_invitations }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <ClipboardDocumentListIcon class="h-6 w-6 text-gray-400" />
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Total Solicitudes
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {{ receivedRequests.length }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Organizations List -->
      <div class="space-y-6">
        <div v-for="organization in organizations" :key="organization.id" class="bg-white shadow rounded-lg overflow-hidden">
          <!-- Organization Header with Cover Image -->
          <div class="relative h-48 bg-gradient-to-r from-blue-500 to-purple-600">
            <img 
              v-if="organization.cover_image_url" 
              :src="organization.cover_image_url" 
              :alt="`Portada de ${organization.title}`"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-black bg-opacity-30"></div>
            
            <!-- Organization Profile Image -->
            <div class="absolute bottom-4 left-6">
              <div class="relative">
                <img 
                  :src="organization.profile_image_url || '/src/assets/images/user_avatar.jpg'" 
                  :alt="`Logo de ${organization.title}`"
                  class="h-20 w-20 rounded-full border-4 border-white object-cover bg-white"
                />
              </div>
            </div>

            <!-- Edit Organization Button -->
            <div class="absolute top-4 right-4">
              <button
                @click="openEditOrganizationModal(organization)"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-black bg-opacity-50 hover:bg-opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <PencilIcon class="h-4 w-4 mr-1" />
                Editar
              </button>
            </div>
          </div>

          <!-- Organization Content -->
          <div class="px-6 py-4">
            <!-- Organization Info -->
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-gray-900 mb-2">
                  {{ organization.title }}
                </h3>
                <p class="text-gray-600 mb-4">
                  {{ organization.description }}
                </p>
                
                <!-- Organization Metrics -->
                <div class="flex items-center space-x-6 text-sm text-gray-500 mb-4">
                  <div class="flex items-center">
                    <UsersIcon class="h-4 w-4 mr-1" />
                    {{ organization.member_count }} miembros
                  </div>
                  <div class="flex items-center">
                    <EnvelopeIcon class="h-4 w-4 mr-1" />
                    {{ organization.pending_invitations_count }} invitaciones pendientes
                  </div>
                  <div class="flex items-center">
                    <CalendarIcon class="h-4 w-4 mr-1" />
                    Creada {{ formatDate(organization.created_at) }}
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex space-x-2 ml-4">
                <button
                  @click="openInviteMemberModal(organization)"
                  class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <UserPlusIcon class="h-4 w-4 mr-2" />
                  Invitar Miembro
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- No organizations state -->
        <div v-if="organizations.length === 0" class="text-center py-12">
          <BuildingOfficeIcon class="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            No tienes organizaciones creadas
          </h3>
          <p class="text-gray-600 mb-6">
            Crea tu primera organización para empezar a recibir solicitudes de clientes.
          </p>
          <button
            @click="openCreateOrganizationModal"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon class="h-4 w-4 mr-2" />
            Crear Organización
          </button>
        </div>
      </div>

      <!-- Organization Posts Section (for each organization) -->
      <div v-for="organization in organizations" :key="`posts-${organization.id}`" class="mt-8">
        <OrganizationPostsSection :organization-id="organization.id" />
      </div>

      <!-- Solicitudes Recibidas Section -->
      <div class="mt-8">
        <ReceivedRequestsSection
          :requests="receivedRequests"
          :organizations="organizations"
          :is-loading="requestsStore.isLoadingRequests"
          @view-detail="viewRequestDetail"
          @status-updated="handleRequestStatusUpdated"
          @refresh="refreshRequests"
        />
      </div>

    <!-- Modals -->
    <CreateOrganizationModal
      :visible="showCreateModal"
      @close="closeCreateModal"
      @created="handleOrganizationCreated"
    />

    <EditOrganizationModal
      :visible="showEditModal"
      :organization="selectedOrganization"
      @close="closeEditModal"
      @updated="handleOrganizationUpdated"
    />

    <InviteMemberModal
      :visible="showInviteModal"
      :organization="selectedOrganization"
      @close="closeInviteModal"
      @invited="handleMemberInvited"
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
  BuildingOfficeIcon,
  UsersIcon,
  EnvelopeIcon,
  ClipboardDocumentListIcon,
  PencilIcon,
  UserPlusIcon,
  CalendarIcon,
  ChatBubbleLeftIcon,
  PlusIcon
} from '@heroicons/vue/24/outline';

// Components
import CreateOrganizationModal from '../modals/CreateOrganizationModal.vue';
import EditOrganizationModal from '../modals/EditOrganizationModal.vue';
import InviteMemberModal from '../modals/InviteMemberModal.vue';
import ReceivedRequestsSection from './sections/ReceivedRequestsSection.vue';
import OrganizationPostsSection from './sections/OrganizationPostsSection.vue';

// Stores
const organizationsStore = useOrganizationsStore();
const requestsStore = useCorporateRequestsStore();
const userStore = useUserStore();
const router = useRouter();

// Reactive state
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showInviteModal = ref(false);
const selectedOrganization = ref(null);

// Computed properties
const isLoading = computed(() => organizationsStore.isLoading || requestsStore.isLoadingRequests);
const organizations = computed(() => organizationsStore.organizations);
const organizationStats = computed(() => organizationsStore.organizationStats);
const receivedRequests = computed(() => requestsStore.receivedRequests);
const isValidRole = computed(() => userStore.currentUser?.role === 'corporate_client');

// Methods
const loadData = async () => {
  try {
    // Verify user role before making requests
    const userRole = userStore.currentUser?.role;
    
    if (!userRole) {
      console.error('User role not available');
      return;
    }
    
    if (userRole !== 'corporate_client') {
      console.error('User is not a corporate client, cannot load corporate dashboard data');
      return;
    }
    
    console.log('Loading corporate client dashboard data...');
    
    await Promise.all([
      organizationsStore.getMyOrganizations(),
      organizationsStore.getOrganizationStats(),
      requestsStore.getReceivedRequests({ page_size: 50 }) // Get more requests for filtering
    ]);
    
    console.log('Dashboard data loaded successfully');
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    
    // Show user-friendly error message based on error type
    if (error.response?.status === 403) {
      console.error('Access denied. User may not have corporate client permissions.');
    } else if (error.response?.status === 401) {
      console.error('Authentication error. User may need to log in again.');
    }
  }
};


// Modal handlers
const openEditOrganizationModal = (organization) => {
  selectedOrganization.value = organization;
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  selectedOrganization.value = null;
};

const openInviteMemberModal = (organization) => {
  selectedOrganization.value = organization;
  showInviteModal.value = true;
};

const closeInviteModal = () => {
  showInviteModal.value = false;
  selectedOrganization.value = null;
};

const openCreateOrganizationModal = () => {
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

// Event handlers
const handleOrganizationCreated = (newOrganization) => {
  closeCreateModal();
  // Refresh organizations data and stats
  Promise.all([
    organizationsStore.getMyOrganizations(),
    organizationsStore.getOrganizationStats()
  ]);
};

const handleOrganizationUpdated = (updatedOrganization) => {
  closeEditModal();
  // Refresh organizations data
  organizationsStore.getMyOrganizations();
};

const handleMemberInvited = (invitationData) => {
  closeInviteModal();
  // Refresh organization stats
  organizationsStore.getOrganizationStats();
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

const refreshRequests = () => {
  // Refresh the requests data
  requestsStore.getReceivedRequests({ page_size: 50 });
};

const handleRequestStatusUpdated = async (statusData) => {
  try {
    // Update request status via store
    await requestsStore.updateReceivedRequest(statusData.requestId, {
      status: statusData.newStatus
    });
    
    // Refresh requests to get updated data
    refreshRequests();
    
  } catch (error) {
    console.error('Error updating request status:', error);
  }
};

// Utility functions
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Hace 1 día';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.ceil(diffDays / 7)} semanas`;
  return formatDate(dateString);
};

// Lifecycle
onMounted(async () => {
  // Only load data when component is mounted, not on app initialization
  console.log('CorporateClientDashboard mounted');
  
  // Ensure user store is initialized
  if (!userStore.currentUser) {
    console.log('Waiting for user data to be available...');
    await userStore.init();
  }
  
  // Double check user role
  const userRole = userStore.currentUser?.role;
  const userAuth = JSON.parse(localStorage.getItem('userAuth') || '{}');
  
  console.log('Current user role (from store):', userRole);
  console.log('Current user role (from localStorage):', userAuth.role);
  console.log('Current user data:', userStore.currentUser);
  console.log('LocalStorage userAuth:', userAuth);
  
  if (userRole === 'corporate_client') {
    loadData();
  } else {
    console.error('User does not have corporate_client role.');
    console.error('Store role:', userRole);
    console.error('LocalStorage role:', userAuth.role);
    console.error('Available roles should be: client, corporate_client, lawyer');
  }
});
</script>
