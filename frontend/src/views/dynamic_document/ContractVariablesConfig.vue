<template>
  <!-- Content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Contract's name -->
      <div>
        <h1 class="text-primary text-xl font-semibold">
          {{ contractName }}
        </h1>
      </div>
      <!-- Relevant information form -->
      <div class="mt-4 space-y-3 grid md:grid-cols-2">
        <!-- Row -->
        <div class="grid space-y-2">
          <!-- Variable's name -->
          <div>
            <h1 class="text-primary text-lg font-semibold">
              nombre_de_la_variable
            </h1>
          </div>
          <div class="grid md:grid-cols-2 gap-3">
            <!-- Namatag form -->
            <div>
              <label
                for="nametag"
                class="block text-base font-medium leading-6 text-primary"
              >
                Nombre en pantalla
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
            <!-- Type of input form -->
            <div>
              <Combobox
                as="div"
                v-model="formData.inputType"
                @update:modelValue="resetQuery"
              >
                <ComboboxLabel
                  class="block text-base font-medium leading-6 text-primary"
                >
                  Tipo de input
                  <span class="text-red-500">*</span>
                </ComboboxLabel>

                <!-- Input ans selection button -->
                <div class="relative mt-2">
                  <ComboboxInput
                    class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                    @input="query = $event.target.value"
                    :display-value="(type) => type || ''"
                  />

                  <ComboboxButton
                    class="absolute inset-y-0 right-0 flex items-center gap-2 rounded-r-md px-2 focus:outline-none border-l border-gray-300"
                  >
                    Seleccionar
                    <ChevronDownIcon
                      class="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </ComboboxButton>

                  <!-- Filtered options -->
                  <ComboboxOptions
                    v-if="filteredInputTypes.length > 0"
                    class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                  >
                    <ComboboxOption
                      v-for="type in filteredInputTypes"
                      :key="type"
                      :value="type"
                      as="template"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'relative cursor-default select-none py-2 pl-3 pr-9',
                          active ? 'bg-secondary text-white' : 'text-primary',
                        ]"
                      >
                        <span
                          :class="[
                            'block truncate',
                            selected && 'font-semibold',
                          ]"
                          >{{ type }}</span
                        >
                        <span
                          v-if="selected"
                          :class="[
                            'absolute inset-y-0 right-0 flex items-center pr-4',
                            active ? 'text-white' : 'text-secondary',
                          ]"
                        >
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </li>
                    </ComboboxOption>
                  </ComboboxOptions>
                </div>
              </Combobox>
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
          <span>Publicar</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
    Combobox,
    ComboboxButton,
    ComboboxInput,
    ComboboxLabel,
    ComboboxOption,
    ComboboxOptions,
} from "@headlessui/vue";
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/20/solid';

// Access route parameters
const route = useRoute();
const contractName = route.params.name;  // Extract 'name' parameter from the route

// Define input types for the combobox
const inputTypes = [
    'Texto simple',   // Simple text input
    'Texto largo',    // Long text input
];

// Reactive state for the query input and form data
const query = ref('');
const formData = ref({
    nametag: null,     // Stores the name tag input
    inputType: null,   // Stores the selected input type
});

// Function to reset the query value
const resetQuery = () => {
    query.value = '';
};

// Computed property to filter input types based on the current query
const filteredInputTypes = computed(() => {
    return inputTypes.filter((type) =>
        type.toLowerCase().includes(query.value.toLowerCase())
    );
});
</script>

