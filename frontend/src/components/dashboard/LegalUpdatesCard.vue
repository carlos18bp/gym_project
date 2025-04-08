<template>
  <swiper :modules="[SwiperAutoplay, SwiperPagination]" 
          :autoplay="{ delay: 5000 }"
          :pagination="{ clickable: true }"
          :space-between="30"
          class="w-full">
    <!-- Slides dinámicos -->
    <swiper-slide v-for="update in legalUpdates" :key="update.id" class="shadow-md p-1">
      <div class="relative rounded-lg overflow-hidden flex max-h-60" style="background-color: #DCF2FF;">
        <div class="flex-grow p-8 pr-16 overflow-hidden">
          <!-- Comillas negras más grandes -->
          <div class="absolute top-6 left-8 text-black text-7xl">❝</div>
          
          <!-- Contenido principal -->
          <div class="mt-10 mb-4 pl-2">
            <p class="text-lg text-gray-800 mb-6 line-clamp-4 font-normal">
              {{ update.content }}
            </p>
            
            <!-- Hipervínculo con subrayado e itálica -->
            <a :href="update.link_url" class="text-sm text-blue-600 hover:text-blue-800 font-medium italic border-b border-blue-600 hover:border-blue-800">
              {{ update.link_text }}
            </a>
          </div>
        </div>
        
        <!-- Imagen con relación de aspecto 5:4 -->
        <div class="flex-shrink-0 self-stretch" style="width: 36%;">
          <div class="w-full h-full bg-black overflow-hidden" 
               style="border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem;">
            <img 
              :src="update.image || 'https://via.placeholder.com/250x200'"
              :alt="update.title || 'Actualización Legal'" 
              class="w-full h-full object-cover"
              @error="handleImageError"
            />
          </div>
        </div>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Autoplay, Pagination } from 'swiper/modules';
import { useLegalUpdateStore } from '@/stores/legalUpdate';
import 'swiper/css';
import 'swiper/css/pagination';

// Renombramos los módulos para que coincidan con el template
const SwiperAutoplay = Autoplay;
const SwiperPagination = Pagination;

// Inicializamos el store
const legalUpdateStore = useLegalUpdateStore();

// Computed para obtener las actualizaciones activas
const legalUpdates = computed(() => legalUpdateStore.activeUpdates);

// Función para manejar errores de carga de imagen
const handleImageError = (e) => {
  e.target.src = 'https://via.placeholder.com/250x200';
};

// Cargamos las actualizaciones al montar el componente
onMounted(async () => {
  await legalUpdateStore.fetchActiveUpdates();
});
</script>

<style scoped>
:deep(.swiper-pagination-bullet) {
  background-color: white;
  margin: 0 5px;
  opacity: 0.7;
}

:deep(.swiper-pagination-bullet-active) {
  background-color: white;
  opacity: 1;
}

:deep(.swiper-pagination) {
  margin-top: 15px;
}

/* Estilo adicional para mejorar la sombra */
:deep(.swiper-slide) {
  filter: drop-shadow(0 6px 5px rgba(0, 0, 0, 0.07)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.05));
}
</style>