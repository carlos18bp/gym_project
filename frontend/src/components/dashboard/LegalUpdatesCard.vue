<template>
  <swiper :modules="[SwiperAutoplay, SwiperPagination]" 
          :autoplay="{ delay: 5000 }"
          :pagination="{ clickable: true }"
          :space-between="30"
          class="w-full">
    <!-- Dynamic slides -->
    <swiper-slide v-for="update in legalUpdates" :key="update.id" class="p-1">
      <div class="relative rounded-lg overflow-hidden flex flex-col sm:flex-row bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
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
              :src="update.image || placeholderImage"
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
import { useLegalUpdateStore } from '@/stores/legal/legalUpdate';
import 'swiper/css';
import 'swiper/css/pagination';

// Rename modules to match the template
const SwiperAutoplay = Autoplay;
const SwiperPagination = Pagination;

// Initialize the store
const legalUpdateStore = useLegalUpdateStore();

// Computed property to get active updates
const legalUpdates = computed(() => legalUpdateStore.activeUpdates);

// Placeholder image as base64 to avoid external dependencies
const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMjUwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD4KICA8L3N2Zz4=';

// Function to handle image loading errors
const handleImageError = (e) => {
  // Prevent infinite loop by checking if we're already using the placeholder
  if (e.target.src !== placeholderImage) {
    e.target.src = placeholderImage;
  }
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

/* Additional style to improve shadow - removed as we're using Tailwind classes */
</style>