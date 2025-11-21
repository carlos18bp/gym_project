<template>
  <div class="bg-white border border-gray-200 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Enlaces Rápidos</h3>
    
    <div class="space-y-2">
      <button
        v-for="link in quickLinks"
        :key="link.module"
        @click="$emit('navigate', link.module)"
        class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
      >
        <div class="flex items-center space-x-3">
          <component :is="link.icon" class="h-5 w-5 text-indigo-600" />
          <span class="text-sm font-medium text-gray-900">{{ link.name }}</span>
        </div>
        <ArrowRightIcon class="h-4 w-4 text-gray-400" />
      </button>
    </div>

    <div class="mt-6 pt-6 border-t border-gray-200">
      <a
        href="https://api.whatsapp.com/message/XR7PDKOQS3R6A1?autoload=1&app_absent=0"
        target="_blank"
        class="flex items-center space-x-2 text-sm text-green-600 hover:text-green-700 transition-colors"
      >
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        <span>¿Necesitas ayuda adicional?</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  HomeIcon,
  FolderIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ArrowRightIcon,
  QuestionMarkCircleIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  role: {
    type: String,
    required: true
  }
});

defineEmits(['navigate']);

const quickLinks = computed(() => {
  const links = {
    lawyer: [
      { module: 'dashboard', name: 'Inicio', icon: HomeIcon },
      { module: 'directory', name: 'Directorio', icon: UsersIcon },
      { module: 'processes', name: 'Procesos', icon: FolderIcon },
      { module: 'documents', name: 'Archivos Jurídicos', icon: DocumentTextIcon }
    ],
    client: [
      { module: 'dashboard', name: 'Inicio', icon: HomeIcon },
      { module: 'processes', name: 'Mis Procesos', icon: FolderIcon },
      { module: 'documents', name: 'Documentos', icon: DocumentTextIcon },
      { module: 'requests', name: 'Solicitudes', icon: InboxArrowDownIcon }
    ],
    corporate_client: [
      { module: 'dashboard', name: 'Inicio', icon: HomeIcon },
      { module: 'processes', name: 'Procesos', icon: FolderIcon },
      { module: 'organizations', name: 'Organizaciones', icon: BuildingOfficeIcon },
      { module: 'requests', name: 'Solicitudes', icon: InboxArrowDownIcon }
    ],
    basic: [
      { module: 'dashboard', name: 'Inicio', icon: HomeIcon },
      { module: 'processes', name: 'Mis Procesos', icon: FolderIcon },
      { module: 'requests', name: 'Solicitudes', icon: InboxArrowDownIcon }
    ]
  };

  return links[props.role] || links.client;
});
</script>
