<template>
  <!-- Using the SearchBarAndFilterBy component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <slot></slot>
  </SearchBarAndFilterBy>
  <div
    v-if="filteredProcesses.length"
    class="py-10 px-4 sm:px-6 lg:px-8 grid place-items-center gap-3 grid-cols-1"
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
              {{ process.case.type }}
            </h1>
            <h2 class="text-sm text-gray-500 font-regular">
              {{ process.subcase }}
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
              <Bubbles
                :length="process.stages.length"
                :displayParam="displayParam ? displayParam : ''"
              />
            </div>

            <!-- Text of states -->
            <div>
              <TextStages :stages="process.stages" />
            </div>
          </div>

          <!-- Button for detail view -->
          <div class="font-medium text-sm mt-8">
            <button
              type="button"
              class="p-2.5 text-white bg-secondary rounded-md"
            >
              <router-link
                :to="{
                  name: 'process_detail',
                  params: { process_id: process.id, display: displayParam },
                }"
              >
                <span>Consultar expediente</span>
              </router-link>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="absolute top-1/2 left-1/2 grid justify-center items-center transform -translate-y-1/2 text-gray-400">
    <CubeTransparentIcon class="mx-auto h-40 w-40"></CubeTransparentIcon>
    <p class="text-center font-semibold pt-4 text-2xl">Parece que no hay<br>nada por aqui.</p>
  </div>
</template>

<script setup>
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import Bubbles from "@/components/process/Bubbles.vue";
import TextStages from "@/components/process/TextStages.vue";
import { ChevronUpIcon, CubeTransparentIcon } from "@heroicons/vue/20/solid";
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

// Filtered processes based on search query
const filteredProcesses = computed(() => {
  return processStore.filteredProcesses(
    searchQuery.value,
    isClient.value,
    user.value ? user.value.id : null,
    displayParam.value
  );
});

const expandedProcesses = ref([]);

onMounted(async () => {
  await processStore.init();
  userIdParam.value = route.params.user_id;
  displayParam.value = route.params.display;

  await userStore.init();
  user.value = userIdParam.value ? userStore.userById(userIdParam.value) : userStore.getCurrentUser;
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
