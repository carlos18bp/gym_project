<template>
  <div class="space-y-6">
    <!-- Module Header -->
    <div class="border-b border-gray-200 pb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        {{ moduleData?.name }}
      </h1>
      <p class="text-gray-600">
        {{ moduleData?.description }}
      </p>
    </div>

    <!-- Section Content or Module Overview -->
    <div v-if="section && sectionData">
      <!-- Back Button -->
      <button
        @click="$emit('section-selected', null)"
        class="inline-flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 mb-4 transition-colors"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span class="font-medium">Volver al módulo</span>
      </button>

      <!-- Section Header -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">
          {{ sectionData.name }}
        </h2>
        <p v-if="sectionData.description" class="text-gray-600">
          {{ sectionData.description }}
        </p>
      </div>

      <!-- Section Content -->
      <div class="prose prose-indigo max-w-none">
        <div v-html="sectionData.content"></div>
      </div>

      <!-- Features List -->
      <div v-if="sectionData.features && sectionData.features.length > 0" class="mt-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Funcionalidades:</h3>
        <ul class="space-y-3">
          <li
            v-for="(feature, index) in sectionData.features"
            :key="index"
            class="flex items-start space-x-3"
          >
            <CheckCircleIcon class="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
            <span class="text-gray-700">{{ feature }}</span>
          </li>
        </ul>
      </div>

      <!-- Screenshots -->
      <div v-if="sectionData.screenshots && sectionData.screenshots.length > 0" class="mt-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Capturas de Pantalla:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="(screenshot, index) in sectionData.screenshots"
            :key="index"
            class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            @click="openImageModal(screenshot)"
          >
            <img
              :src="screenshot.url"
              :alt="screenshot.caption"
              class="w-full h-auto"
            />
            <div v-if="screenshot.caption" class="p-3 bg-gray-50">
              <p class="text-sm text-gray-600">{{ screenshot.caption }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Step by Step Guide -->
      <div v-if="sectionData.steps && sectionData.steps.length > 0" class="mt-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Paso a Paso:</h3>
          <button
            v-if="sectionData.example"
            @click="showExample = true"
            class="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <LightBulbIcon class="h-5 w-5" />
            <span>Ver Ejemplo Completo</span>
          </button>
        </div>
        <ol class="space-y-4">
          <li
            v-for="(step, index) in sectionData.steps"
            :key="index"
            class="flex items-start space-x-4"
          >
            <div class="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
              {{ index + 1 }}
            </div>
            <div class="flex-1">
              <p class="text-gray-900 font-medium">{{ step.title }}</p>
              <p class="text-gray-600 text-sm mt-1">{{ step.description }}</p>
            </div>
          </li>
        </ol>
      </div>

      <!-- Example Modal -->
      <ExampleModal
        v-if="sectionData.example"
        :open="showExample"
        :example="sectionData.example"
        @close="showExample = false"
      />

      <!-- Tips -->
      <div v-if="sectionData.tips && sectionData.tips.length > 0" class="mt-8">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <LightBulbIcon class="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 class="font-semibold text-blue-900 mb-2">Consejos:</h4>
              <ul class="space-y-2">
                <li
                  v-for="(tip, index) in sectionData.tips"
                  :key="index"
                  class="text-sm text-blue-800"
                >
                  • {{ tip }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Restrictions (for role-specific limitations) -->
      <div v-if="sectionData.restrictions && sectionData.restrictions.length > 0" class="mt-8">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <ExclamationTriangleIcon class="h-6 w-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h4 class="font-semibold text-yellow-900 mb-2">Restricciones:</h4>
              <ul class="space-y-2">
                <li
                  v-for="(restriction, index) in sectionData.restrictions"
                  :key="index"
                  class="text-sm text-yellow-800"
                >
                  • {{ restriction }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Module Overview (when no section is selected) -->
    <div v-else>
      <div class="prose prose-indigo max-w-none">
        <div v-html="moduleData?.overview"></div>
      </div>

      <!-- Available Sections -->
      <div v-if="moduleData?.sections && moduleData.sections.length > 0" class="mt-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Secciones Disponibles:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            v-for="sec in moduleData.sections"
            :key="sec.id"
            @click="$emit('section-selected', sec.id)"
            class="text-left p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <h4 class="font-semibold text-gray-900 mb-1">{{ sec.name }}</h4>
            <p class="text-sm text-gray-600">{{ sec.description }}</p>
          </button>
        </div>
      </div>
    </div>

    <!-- Related Links -->
    <div v-if="relatedLinks.length > 0" class="mt-8 pt-8 border-t border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Enlaces Relacionados:</h3>
      <div class="space-y-2">
        <a
          v-for="(link, index) in relatedLinks"
          :key="index"
          :href="link.url"
          class="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
          <span>{{ link.text }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import {
  CheckCircleIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline';
import { useUserGuideStore } from '@/stores/user_guide';
import ExampleModal from './ExampleModal.vue';

const props = defineProps({
  module: {
    type: String,
    required: true
  },
  section: {
    type: String,
    default: null
  },
  role: {
    type: String,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  }
});

defineEmits(['section-selected']);

const guideStore = useUserGuideStore();

const showExample = ref(false);

const moduleData = computed(() => {
  return guideStore.getModuleContent(props.module, props.role);
});

const sectionData = computed(() => {
  if (!props.section || !moduleData.value) return null;
  return moduleData.value.sections?.find(s => s.id === props.section);
});

const relatedLinks = computed(() => {
  // Return related links based on module and section
  return [];
});

const openImageModal = (screenshot) => {
  // Implement image modal functionality
  console.log('Open image:', screenshot);
};
</script>
