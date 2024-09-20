<template>
  <div>
    <SlideBar>
      <div class="flex-1 grid place-items-center">
        <div
          v-for="process in processes"
          :key="process.id"
          class="w-1/2 p-5 rounded-lg border-2 border-stroke bg-terciary grid"
        >
          <!-- Card header -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <img src="@/assets/icons/file-01.svg" class="h-6 w-6" />
              <div class="grid">
                <h1 class="text-base text-primary font-medium">
                  {{ process.case_type }}
                </h1>
                <h2 class="text-sm text-gray-500 font-regular">
                  {{ process.subcase }}
                </h2>
              </div>
            </div>
            <ChevronUpIcon class="h-6 w-6"></ChevronUpIcon>
          </div>
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
                <span class="hidden lg:block">Consultar expediente</span>
              </router-link>
            </button>
          </div>
        </div>
      </div>
    </SlideBar>
  </div>
</template>

<script setup>
import SlideBar from "@/components/layouts/SlideBar.vue";
import Bubbles from "@/components/process/Bubbles.vue";
import TextStages from "@/components/process/TextStages.vue";
import { ChevronUpIcon } from "@heroicons/vue/20/solid";
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useProcessStore } from "@/stores/process";

const route = useRoute();
const displayParam = ref("");

const processStore = useProcessStore();
const processes = ref([]);

onMounted(async () =>{
  displayParam.value = route.params.display;
  loadProcesses()
});

watch(
  () => route.params.display,
  async (newDisplay) => {
    displayParam.value = newDisplay;
    await loadProcesses();
  }
);

const loadProcesses = async () => {
  await processStore.fetchProcessesData();

  if (displayParam.value == "history") {
    processes.value = processStore.processesWithClosedStatus;
  } else {
    processes.value = processStore.processesWithoutClosedStatus;
  }
};
</script>
