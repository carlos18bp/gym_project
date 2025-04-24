<template>
  <swiper :modules="[SwiperAutoplay, SwiperPagination]" 
          :autoplay="{ delay: 5000 }"
          :pagination="{ clickable: true }"
          :space-between="30"
          class="w-full">
    <!-- Dynamic slides -->
    <swiper-slide v-for="update in legalUpdates" :key="update.id" class="shadow-md p-1">
      <div class="relative rounded-lg overflow-hidden flex flex-col sm:flex-row" style="background-color: #DCF2FF;">
        <div class="flex-grow p-8 overflow-hidden flex flex-col sm:w-[60%]">
          <!-- Larger black quotation mark -->
          <div class="absolute top-6 left-8 text-black text-7xl">❝</div>
          
          <!-- Main content -->
          <div class="mt-10 pl-2 flex-grow">
            <p class="text-lg text-gray-800 mb-8 sm:line-clamp-4 line-clamp-5 font-normal">
              {{ update.content }}
            </p>
          </div>
          
          <!-- Hyperlink with underline and italic style - moved to bottom with more space -->
          <div class="pl-2 pb-6">
            <a :href="update.link_url" 
               target="_blank" 
               rel="noopener noreferrer"
               class="text-sm text-blue-600 hover:text-blue-800 font-medium italic border-b border-blue-600 hover:border-blue-800">
              {{ update.link_text }}
            </a>
          </div>
        </div>
        
        <!-- Image with 5:4 aspect ratio - hidden on mobile -->
        <div class="hidden sm:block sm:w-[40%]">
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

// Rename modules to match the template
const SwiperAutoplay = Autoplay;
const SwiperPagination = Pagination;

// Initialize the store
const legalUpdateStore = useLegalUpdateStore();

// Computed property to get active updates
const legalUpdates = computed(() => legalUpdateStore.activeUpdates);

// Function to handle image loading errors
const handleImageError = (e) => {
  e.target.src = 'https://via.placeholder.com/250x200';
};

// Load updates when component is mounted
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

/* Additional style to improve shadow */
:deep(.swiper-slide) {
  filter: drop-shadow(0 6px 5px rgba(0, 0, 0, 0.07)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.05));
}
</style>