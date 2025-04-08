<template>
  <!-- Using the SearchBarAndFilterBy component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <slot></slot>    
    <template v-if="currentUser?.role == 'lawyer'" #auxiliary_button>
      <router-link 
        :to="{ name: 'process_form', params: { action: 'create' } }"  
        class="flex items-center gap-2 rounded-lg bg-secondary text-white px-4 py-2"
      >
        <PlusIcon class="size-5" aria-hidden="true" />
        <span class="text-sm font-medium">Nuevo</span>
      </router-link>
      <Menu as="div" class="relative inline-block text-left">
        <div>
          <MenuButton
            class="flex items-center rounded-full bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <span class="sr-only">Open options</span>
            <AdjustmentsVerticalIcon class="size-5" aria-hidden="true" />
          </MenuButton>
        </div>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems
            class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
          >
            <div class="py-1">
              <MenuItem v-slot="{ active }">
                <a
                  @click="processGroup = 'default'"
                  :class="[
                    active
                      ? 'bg-gray-100 text-gray-900 outline-none'
                      : 'text-gray-700',
                    'block px-4 py-2 text-sm cursor-pointer hover:bg-gray-200/80',
                  ]"
                  >Mis procesos</a
                >
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <a
                  @click="processGroup = 'general'"
                  :class="[
                    active
                      ? 'bg-gray-100 text-gray-900 outline-none'
                      : 'text-gray-700',
                    'block px-4 py-2 text-sm cursor-pointer hover:bg-gray-200/80',
                  ]"
                  >Todos los procesos</a
                >
              </MenuItem>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </template>
  </SearchBarAndFilterBy>

  <div
    v-if="filteredProcesses.length"
    class="py-10 px-4 sm:px-6 lg:px-8 grid gap-3 auto-rows-auto place-items-start grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"
  >
    <div
      v-for="process in filteredProcesses"
      :key="process.id"
      class="p-5 rounded-lg border-2 border-stroke bg-terciary grid w-full"
    >
      <!-- Card header -->
      <div
        class="flex items-center justify-between gap-3 cursor-pointer"
        @click="toggleExpand(process.id)"
      >
        <div class="flex items-center gap-3">
          <img src="@/assets/icons/file-01.svg" class="h-6 w-6" />
          <div class="grid">
            <h1 class="text-base text-primary font-medium">
              {{ process.client.first_name }} {{ process.client.last_name }}
            </h1>
            <h2 class="text-sm text-gray-500 font-regular">
              {{ process.case.type }}
            </h2>
          </div>
        </div>
        <ChevronUpIcon
          class="h-6 w-6 cursor-pointer"
          :class="
            expandedProcesses.includes(process.id)
              ? 'transform rotate-180'
              : 'transform rotate-0'
          "
        >
        </ChevronUpIcon>
      </div>

      <!-- Content -->
      <div v-if="expandedProcesses.includes(process.id)">
        <!-- Relevant information -->
        <div class="font-medium mt-4 space-y-1">
          <!-- Authority information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Autoridad:</h3>
            <p class="text-gray-500">
              {{ process.authority }}
            </p>
          </div>
          <!-- Accionant information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Dte./Accionante:</h3>
            <p class="text-gray-500">{{ process.plaintiff }}</p>
          </div>
          <!-- plaintiff information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Dte./Accionado:</h3>
            <p class="text-gray-500">{{ process.defendant }}</p>
          </div>
          <!-- Ref information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Radicado:</h3>
            <p class="text-gray-500">{{ process.ref }}</p>
          </div>
          <!-- Last stage -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Etapa Procesal:</h3>
            <p class="text-gray-500">
              {{ process.stages[process.stages.length - 1].status }}
            </p>
          </div>
        </div>

        <!-- Content -->
        <div>
          <!-- Timeline of process state -->
          <div class="relative mt-16">
            <!-- Line -->
            <div class="relative">
              <div class="flex justify-between">
                <div class="border-2 border-gray-500 h-4 w-0"></div>
                <div class="border-2 border-gray-500 h-4 w-0"></div>
              </div>
              <div class="border-2 border-gray-500"></div>
              <div class="flex justify-between">
                <div class="border-2 border-gray-500 h-4 w-0"></div>
                <div class="border-2 border-gray-500 h-4 w-0"></div>
              </div>

              <!-- Bubbles -->
              <div
                class="absolute top-1/2 left-0 right-0 z-10 transform -translate-y-1/2 flex w-full h-full px-16 justify-center items-center"
              >
                <div class="size-16 bg-secondary rounded-full"></div>
              </div>
            </div>

            <!-- Text of states -->
            <div>
              <div
                class="relative mt-5 px-16 flex justify-center items-center text-gray-500 font-medium"
              >
                <p class="text-sm w-16 text-center">
                  {{
                    process.stages.length > 0
                      ? process.stages[process.stages.length - 1].status
                      : "Sin estado"
                  }}
                </p>
              </div>
            </div>
          </div>

          <!-- Button for detail view -->
          <div class="font-medium text-sm mt-8">
            <router-link
              class="p-2.5 text-white bg-secondary rounded-md"
              :to="{
                name: 'process_detail',
                params: { process_id: process.id, display: displayParam },
              }"
            >
              <span>Consultar expediente</span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else
    class="absolute top-1/2 left-1/2 grid justify-center items-center transform -translate-y-1/2 -translate-x-1/2 lg:-translate-x-0 text-gray-400"
  >
    <CubeTransparentIcon class="mx-auto h-40 w-40"></CubeTransparentIcon>
    <p class="text-center font-semibold pt-4 text-2xl">
      No hay procesos disponibles<br />para mostrar.
    </p>
    <p class="text-center font-semibold pt-4 text-lg">Contacta a tu abogado para gestionar tus procesos.</p>
  </div>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import { AdjustmentsVerticalIcon, ChevronUpIcon, CubeTransparentIcon, PlusIcon } from "@heroicons/vue/20/solid";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";
import { useProcessStore } from "@/stores/process";

const route = useRoute();
const userIdParam = ref("");
const displayParam = ref("");

const userStore = useUserStore();
const processStore = useProcessStore();

const user = ref(null);
const isClient = ref(true);

// Reactive variable for search query
const searchQuery = ref("");
const processGroup = ref("default");

// Computed property to get the current authenticated user
const currentUser = computed(() => userStore.getCurrentUser);

const expandedProcesses = ref([]);

onMounted(async () => {
  await processStore.init();
  userIdParam.value = route.params.user_id;
  displayParam.value = route.params.display;

  await userStore.init();
  user.value = userIdParam.value
    ? userStore.userById(userIdParam.value)
    : userStore.getCurrentUser;
  isClient.value = !!(user.value.role == "client");
});

watch(
  () => route.params.user_id,
  async (newUserId) => {
    userIdParam.value = newUserId;
    displayParam.value = route.params.display;
  }
);

watch(
  () => route.params.display,
  async (newDisplay) => {
    userIdParam.value = route.params.user_id;
    displayParam.value = newDisplay;
  }
);

// Filtered processes based on search query
const filteredProcesses = computed(() => {
  if (processGroup.value === "default") {
    return processStore.filteredProcesses(
      searchQuery.value,
      isClient.value,
      user.value ? user.value.id : null,
      displayParam.value
    );
  } else if (processGroup.value === "general") {
    return processStore.filteredProcesses(
      searchQuery.value,
      isClient.value,
      null,
      displayParam.value
    );
  }
});

/**
 * Toggles the expansion state of a process by its ID.
 *
 * This function checks if the given `id` is present in the `expandedProcesses` array.
 * If the `id` is already present, it removes the `id` from the array, collapsing the process.
 * If the `id` is not present, it adds the `id` to the array, expanding the process.
 *
 * @function toggleExpand
 * @param {number|string} id - The unique identifier of the process to toggle.
 * @returns {void}
 */
const toggleExpand = (id) => {
  if (expandedProcesses.value.includes(id)) {
    expandedProcesses.value = expandedProcesses.value.filter(
      (item) => item !== id
    );
  } else {
    expandedProcesses.value.push(id);
  }
};
</script>
