<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog as="div" class="relative z-50" @close="closeModal">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <!-- Close button -->
              <div class="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  @click="closeModal"
                >
                  <span class="sr-only">Cerrar</span>
                  <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <!-- Icon -->
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ArrowDownTrayIcon class="h-6 w-6 text-indigo-600" aria-hidden="true" />
                </div>
                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <DialogTitle as="h3" class="text-lg font-semibold leading-6 text-gray-900">
                    Instalar Aplicación
                  </DialogTitle>
                  <div class="mt-4">
                    <p class="text-sm text-gray-600 mb-4">
                      Para instalar la aplicación en tu dispositivo, sigue estos pasos:
                    </p>

                    <!-- Browser-specific instructions -->
                    <div v-if="browser === 'firefox'" class="space-y-3">
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">1</span>
                        </div>
                        <p class="text-sm text-gray-700">Haz clic en el icono de <strong>menú (☰)</strong> en la barra de direcciones</p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">2</span>
                        </div>
                        <p class="text-sm text-gray-700">Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong></p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">3</span>
                        </div>
                        <p class="text-sm text-gray-700">Confirma la instalación</p>
                      </div>
                    </div>

                    <div v-else-if="browser === 'edge'" class="space-y-3">
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">1</span>
                        </div>
                        <p class="text-sm text-gray-700">Haz clic en el icono <strong>"⋯"</strong> (más opciones) en la barra superior</p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">2</span>
                        </div>
                        <p class="text-sm text-gray-700">Selecciona <strong>"Aplicaciones"</strong> → <strong>"Instalar este sitio como una aplicación"</strong></p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">3</span>
                        </div>
                        <p class="text-sm text-gray-700">O busca el icono <strong>"+"</strong> en la barra de direcciones</p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">4</span>
                        </div>
                        <p class="text-sm text-gray-700">Confirma la instalación</p>
                      </div>
                    </div>

                    <div v-else-if="browser === 'safari'" class="space-y-3">
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">1</span>
                        </div>
                        <p class="text-sm text-gray-700">Toca el botón <strong>"Compartir"</strong> (cuadro con flecha)</p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">2</span>
                        </div>
                        <p class="text-sm text-gray-700">Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong></p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">3</span>
                        </div>
                        <p class="text-sm text-gray-700">Confirma con <strong>"Añadir"</strong></p>
                      </div>
                    </div>

                    <div v-else class="space-y-3">
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">1</span>
                        </div>
                        <p class="text-sm text-gray-700">Busca el icono de <strong>instalación</strong> en la barra de direcciones</p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">2</span>
                        </div>
                        <p class="text-sm text-gray-700">O accede al <strong>menú del navegador</strong></p>
                      </div>
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-xs font-semibold text-indigo-600">3</span>
                        </div>
                        <p class="text-sm text-gray-700">Selecciona la opción de <strong>instalar/añadir a inicio</strong></p>
                      </div>
                    </div>

                    <!-- Browser badge -->
                    <div class="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p class="text-xs text-gray-500">
                        Navegador detectado: <span class="font-semibold text-gray-700">{{ browserName }}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  class="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:ml-3 sm:w-auto"
                  @click="closeModal"
                >
                  Entendido
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed } from 'vue'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  browser: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const browserName = computed(() => {
  const names = {
    'firefox': 'Mozilla Firefox',
    'edge': 'Microsoft Edge',
    'chrome': 'Google Chrome',
    'safari': 'Safari',
    'unknown': 'Desconocido'
  }
  return names[props.browser] || 'Desconocido'
})

const closeModal = () => {
  emit('close')
}
</script>
