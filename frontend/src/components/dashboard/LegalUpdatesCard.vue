<template>
  <swiper :modules="[SwiperAutoplay, SwiperPagination]" 
          :autoplay="{ delay: 5000 }"
          :pagination="{ clickable: true }"
          :space-between="30"
          class="w-full">
    <!-- Slide 1 con sombra aplicada al nivel del swiper-slide -->
    <swiper-slide class="shadow-md p-1">
      <div class="relative rounded-lg overflow-hidden flex max-h-60" style="background-color: #DCF2FF;">
        <div class="flex-grow p-8 pr-16 overflow-hidden">
          <!-- Comillas negras más grandes -->
          <div class="absolute top-6 left-8 text-black text-7xl">❝</div>
          
          <!-- Contenido principal -->
          <div class="mt-10 mb-4 pl-2">
            <p class="text-lg text-gray-800 mb-6 line-clamp-4 font-normal">
              Mantente al día con las actualizaciones más relevantes del sector legal, cambios normativos, 
              sentencias clave y noticias del bufete. Aquí encontrarás información útil para tu ejercicio profesional 
              y la gestión de tus procesos.
            </p>
            
            <!-- Hipervínculo con subrayado e itálica -->
            <a href="#" class="text-sm text-blue-600 hover:text-blue-800 font-medium italic border-b border-blue-600 hover:border-blue-800">
              Últimas novedades jurídicas
            </a>
          </div>
        </div>
        
        <!-- Imagen con relación de aspecto 5:4 -->
        <div class="flex-shrink-0 self-stretch" style="width: 36%;">
          <div class="w-full h-full bg-black overflow-hidden" 
               style="border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem;">
            <img 
              src="https://images.unsplash.com/photo-1589578527966-fdac0f44566c?q=80&w=1974&auto=format&fit=crop"
              alt="Lady Justice" 
              class="w-full h-full object-cover"
              @error="handleImageError"
            />
          </div>
        </div>
      </div>
    </swiper-slide>
    
    <!-- Slide 2 con sombra aplicada al nivel del swiper-slide -->
    <swiper-slide class="shadow-md p-1">
      <div class="relative rounded-lg overflow-hidden flex max-h-60" style="background-color: #DCF2FF;">
        <div class="flex-grow p-8 pr-16 overflow-hidden">
          <!-- Comillas negras más grandes -->
          <div class="absolute top-6 left-8 text-black text-7xl">❝</div>
          
          <!-- Contenido principal -->
          <div class="mt-10 mb-4 pl-2">
            <p class="text-lg text-gray-800 mb-6 line-clamp-4 font-normal">
              Nueva normativa sobre protección de datos en procesos judiciales electrónicos. 
              Implementación obligatoria a partir del próximo trimestre para todos los despachos 
              y profesionales del sector.
            </p>
            
            <!-- Hipervínculo con subrayado e itálica -->
            <a href="#" class="text-sm text-blue-600 hover:text-blue-800 font-medium italic border-b border-blue-600 hover:border-blue-800">
              Ver detalles de la normativa
            </a>
          </div>
        </div>
        
        <!-- Imagen con relación de aspecto 5:4 -->
        <div class="flex-shrink-0 self-stretch" style="width: 36%;">
          <div class="w-full h-full bg-black overflow-hidden" 
               style="border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem;">
            <img 
              src="https://images.unsplash.com/photo-1575505586569-646b2ca898fc?q=80&w=2005&auto=format&fit=crop"
              alt="Legal Documents" 
              class="w-full h-full object-cover"
              @error="handleImageError"
            />
          </div>
        </div>
      </div>
    </swiper-slide>

    <!-- Slide 3 con sombra aplicada al nivel del swiper-slide -->
    <swiper-slide class="shadow-md p-1">
      <div class="relative rounded-lg overflow-hidden flex max-h-60" style="background-color: #DCF2FF;">
        <div class="flex-grow p-8 pr-16 overflow-hidden">
          <!-- Comillas negras más grandes -->
          <div class="absolute top-6 left-8 text-black text-7xl">❝</div>
          
          <!-- Contenido principal -->
          <div class="mt-10 mb-4 pl-2">
            <p class="text-lg text-gray-800 mb-6 line-clamp-4 font-normal">
              Sentencia del Tribunal Supremo establece nuevo precedente en casos de responsabilidad 
              civil derivada de accidentes laborales en entornos de teletrabajo.
            </p>
            
            <!-- Hipervínculo con subrayado e itálica -->
            <a href="#" class="text-sm text-blue-600 hover:text-blue-800 font-medium italic border-b border-blue-600 hover:border-blue-800">
              Leer sentencia completa
            </a>
          </div>
        </div>
        
        <!-- Imagen con relación de aspecto 5:4 -->
        <div class="flex-shrink-0 self-stretch" style="width: 36%;">
          <div class="w-full h-full bg-black overflow-hidden" 
               style="border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem;">
            <img 
              src="https://images.unsplash.com/photo-1593115057322-e94b77572f20?q=80&w=2071&auto=format&fit=crop"
              alt="Court Gavel" 
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
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

// Renombramos los módulos para que coincidan con el template
const SwiperAutoplay = Autoplay;
const SwiperPagination = Pagination;

// Función para manejar errores de carga de imagen
const handleImageError = (e) => {
  // Establecer imagen de respaldo si la principal falla
  e.target.src = 'https://via.placeholder.com/250x200';
};
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