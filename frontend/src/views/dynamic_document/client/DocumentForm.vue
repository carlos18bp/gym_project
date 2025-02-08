<template>
    <!-- Content -->
    <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
      <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
        <!-- Document's name -->
        <div>
          <h1 class="text-primary text-xl font-semibold">
            {{ documentName }}
          </h1>
        </div>
        <!-- Relevant information form -->
        <div class="mt-4 space-y-3 grid md:grid-cols-2">
          <!-- Row -->
          <div class="grid space-y-2">
            <div class="grid md:grid-cols-2 gap-3">
              <!-- Namatag form -->
              <div>
                <label
                  for="nametag"
                  class="block text-base font-medium leading-6 text-primary"
                >
                  Ciudad
                  <span class="text-red-500">*</span>
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="nametag"
                    id="nametag"
                    class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Action Buttons -->
        <div class="mt-6 flex space-x-4">
          <button
            type="button"
            class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-secondary text-white"
          >
            <span>Guardar</span>
          </button>
          <button
            type="button"
            class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50"
          >
            <span>Generar</span>
          </button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useRoute } from 'vue-router';
  
  // Access route parameters
  const route = useRoute();
  const documentName = route.params.name;  // Extract 'name' parameter from the route
  
  const formData = ref({
      city: null,     // Stores the name tag input
  });
  </script>