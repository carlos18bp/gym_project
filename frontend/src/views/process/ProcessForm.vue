<template>
  <SlideBar>
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Title -->
      <div>
        <h1 class="text-primary text-xl font-semibold">
          Información del proceso
        </h1>
      </div>
      <!-- Relevant information form -->
      <div class="mt-4 space-y-3">
        <!-- First row -->
        <div class="grid grid-cols-4 gap-3">
          <!-- Plaintiff form -->
          <div>
            <label
              for="plaintiff"
              class="block text-base font-medium leading-6 text-primary"
            >
              Dte./Accionante
              <span class="text-red-500">*</span></label
            >
            <div class="mt-2">
              <input
                type="text"
                name="plaintiff"
                id="plaintiff"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          <!-- Defendant form -->
          <div>
            <label
              for="defendant"
              class="block text-base font-medium leading-6 text-primary"
            >
              Dte./Accionado
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                type="text"
                name="defendant"
                id="defendant"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          <!-- Type case form -->
          <div>
            <Combobox
              as="div"
              v-model="selectedCaseType"
              @update:modelValue="query = ''"
            >
              <ComboboxLabel
                class="block text-base font-medium leading-6 text-primary"
              >
                Tipo de caso
                <span class="text-red-500">*</span>
              </ComboboxLabel>
              <div class="relative mt-2">
                <ComboboxInput
                  class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  @change="query = $event.target.value"
                  @blur="query = ''"
                  :display-value="(caseType) => caseType?.name"
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

                <ComboboxOptions
                  v-if="filteredCaseTypes.length > 0"
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  <ComboboxOption
                    v-for="caseType in filteredCaseTypes"
                    :key="caseType.id"
                    :value="caseType"
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
                        :class="['block truncate', selected && 'font-semibold']"
                      >
                        {{ caseType.name }}
                      </span>

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
          <!-- Subcase form -->
          <div>
            <label
              for="defendant"
              class="block text-base font-medium leading-6 text-primary"
            >
              Subcaso
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                type="text"
                name="defendant"
                id="defendant"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </div>
        <!-- Second row -->
        <div class="grid grid-cols-3 gap-3">
          <!-- Ref form -->
          <div>
            <label
              for="plaintiff"
              class="block text-base font-medium leading-6 text-primary"
            >
              Radicado
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                type="text"
                name="plaintiff"
                id="plaintiff"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          <!-- Authority form -->
          <div>
            <label
              for="plaintiff"
              class="block text-base font-medium leading-6 text-primary"
            >
              Autoridad
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                type="text"
                name="plaintiff"
                id="plaintiff"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          <!-- Client form -->
          <div>
            <Combobox
              as="div"
              v-model="selectedPerson"
              @update:modelValue="query = ''"
            >
              <ComboboxLabel
                class="block text-sm font-medium leading-6 text-primary"
              >
                Usuario
                <span class="text-red-500">*</span>
              </ComboboxLabel>
              <div class="relative mt-2">
                <ComboboxInput
                  class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-12 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  @change="query = $event.target.value"
                  @blur="query = ''"
                  :display-value="(person) => person?.name"
                />
                <ComboboxButton
                  class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
                >
                  <ChevronDownIcon
                    class="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </ComboboxButton>

                <ComboboxOptions
                  v-if="filteredPeople.length > 0"
                  class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  <ComboboxOption
                    v-for="person in filteredPeople"
                    :key="person.id"
                    :value="person"
                    as="template"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                        active ? 'bg-secondary text-white' : 'text-primary',
                      ]"
                    >
                      <div class="flex items-center">
                        <img
                          :src="person.imageUrl"
                          alt=""
                          class="h-6 w-6 flex-shrink-0 rounded-full"
                        />
                        <span
                          :class="[
                            'ml-3 truncate',
                            selected && 'font-semibold',
                          ]"
                        >
                          {{ person.name }}
                        </span>
                      </div>

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
        <!-- Third row -->
        <div>
          <!-- Title and button add container -->
          <div class="flex items-center gap-3 font-medium">
            <p class="inline-block text-base text-primary">
              Etapa procesal
              <span class="text-red-500">*</span>
            </p>
            <button
              class="flex items-center px-2 py-1 rounded-md text-sm text-secondary bg-selected-background"
            >
              <PlusIcon class="h-5 w-5" />
              Nuevo
            </button>
          </div>
        </div>
        <!-- Fourth row -->
        <div>
          <!-- Title and button add container -->
          <div class="flex items-center gap-3 font-medium">
            <p class="inline-block text-base text-primary">Expediente</p>
            <button
              class="flex items-center px-2 py-1 rounded-md text-sm text-secondary bg-selected-background"
            >
              <PlusIcon class="h-5 w-5" />
              Nuevo
            </button>
          </div>
        </div>
        <!-- Save button -->
        <div>
          <button
            type="button"
            class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
          >
            <span class="hidden lg:block">Guardar</span>
          </button>
        </div>
      </div>
    </div>
  </SlideBar>
</template>

<script setup>
import SlideBar from "@/components/layouts/SlideBar.vue";
import { computed, ref } from "vue";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@heroicons/vue/20/solid";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";

const caseTypes = [
  { id: 1, name: "Laboral" },
  { id: 2, name: "Penal" },
  { id: 3, name: "Civil" },
  // More cases ...
];

const query = ref("");
const selectedCaseType = ref(null);
const filteredCaseTypes = computed(() =>
  query.value === ""
    ? caseTypes
    : caseTypes.filter((caseType) => {
        return caseType.name.toLowerCase().includes(query.value.toLowerCase());
      })
);

const people = [
  {
    id: 1,
    name: "Leslie Alexander",
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  },
  // More users...
];

const selectedPerson = ref(null);
const filteredPeople = computed(() =>
  query.value === ""
    ? people
    : people.filter((person) => {
        return person.name.toLowerCase().includes(query.value.toLowerCase());
      })
);
</script>
