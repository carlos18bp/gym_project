<template>
  <nav class="p-4 space-y-2">
    <!-- Role Badge -->
    <div class="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
      <div class="flex items-center space-x-2 mb-2">
        <UserCircleIcon class="h-5 w-5 text-indigo-600" />
        <span class="text-sm font-medium text-indigo-900">Tu Rol</span>
      </div>
      <p class="text-lg font-bold text-indigo-700">
        {{ getRoleName(currentRole) }}
      </p>
    </div>

    <!-- Modules List -->
    <div class="space-y-1">
      <div
        v-for="module in availableModules"
        :key="module.id"
        class="space-y-1"
      >
        <!-- Module Button -->
        <button
          @click="selectModule(module.id)"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors',
            selectedModule === module.id
              ? 'bg-indigo-100 text-indigo-900 font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          ]"
        >
          <div class="flex items-center space-x-3">
            <component
              :is="module.icon"
              :class="[
                'h-5 w-5',
                selectedModule === module.id ? 'text-indigo-600' : 'text-gray-500'
              ]"
            />
            <span>{{ module.name }}</span>
          </div>
          <ChevronRightIcon
            v-if="module.sections && module.sections.length > 0"
            :class="[
              'h-4 w-4 transition-transform',
              selectedModule === module.id ? 'rotate-90' : ''
            ]"
          />
        </button>

        <!-- Sections (if module is selected) -->
        <div
          v-if="selectedModule === module.id && module.sections"
          class="ml-8 mt-1 space-y-1"
        >
          <button
            v-for="section in module.sections"
            :key="section.id"
            @click="selectSection(section.id)"
            :class="[
              'w-full text-left px-4 py-2 rounded-lg text-sm transition-colors',
              selectedSection === section.id
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            ]"
          >
            {{ section.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Help Section -->
    <div class="mt-8 p-4 bg-gray-100 rounded-lg">
      <div class="flex items-start space-x-3">
        <QuestionMarkCircleIcon class="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900 mb-1">¿Necesitas ayuda?</p>
          <p class="text-xs text-gray-600 mb-2">
            Si no encuentras lo que buscas, contáctanos
          </p>
          <a
            href="https://api.whatsapp.com/message/XR7PDKOQS3R6A1?autoload=1&app_absent=0"
            target="_blank"
            class="inline-flex items-center space-x-2 text-xs text-green-600 hover:text-green-700 font-medium"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>Contactar por WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import {
  UserCircleIcon,
  ChevronRightIcon,
  QuestionMarkCircleIcon
} from '@heroicons/vue/24/outline';
import { useUserGuideStore } from '@/stores/user_guide';

const props = defineProps({
  currentRole: {
    type: String,
    required: true
  },
  selectedModule: {
    type: String,
    default: null
  },
  selectedSection: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['module-selected', 'section-selected', 'close']);

const guideStore = useUserGuideStore();

const availableModules = computed(() => {
  return guideStore.getModulesForRole(props.currentRole);
});

const selectModule = (moduleId) => {
  emit('module-selected', moduleId);
};

const selectSection = (sectionId) => {
  emit('section-selected', sectionId);
};

const getRoleName = (role) => {
  const roleNames = {
    lawyer: 'Abogado',
    client: 'Cliente',
    corporate_client: 'Cliente Corporativo',
    basic: 'Usuario Básico'
  };
  return roleNames[role] || role;
};
</script>
