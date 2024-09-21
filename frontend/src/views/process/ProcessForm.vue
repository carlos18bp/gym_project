<template>
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
            <span class="text-red-500">*</span>
          </label>
          <div class="mt-2">
            <input
              v-model="formData.plaintiff"
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
              v-model="formData.defendant"
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
                :display-value="(caseType) => caseType?.type"
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
                      {{ caseType.type }}
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
              v-model="formData.subcase"
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
              v-model="formData.ref"
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
              v-model="formData.authority"
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
            v-model="selectedClient"
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
                :display-value="
                  (client) =>
                    client?.last_name && client?.first_name
                      ? `${client?.last_name} ${client?.first_name}`
                      : ''
                "
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
                v-if="filteredClients.length > 0"
                class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
              >
                <ComboboxOption
                  v-for="client in filteredClients"
                  :key="client.id"
                  :value="client"
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
                        :src="client.photo_profile || userAvatar"
                        alt="Foto de perfil"
                        class="h-6 w-6 flex-shrink-0 rounded-full"
                      />

                      <span
                        :class="['ml-3 truncate', selected && 'font-semibold']"
                      >
                        {{ client.last_name }} {{ client.first_name }}
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
        <!-- Stages table -->
        <div class="qflow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div
              class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
            >
              <table class="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr class="text-left text-base font-regular text-primary">
                    <th scope="col" class="py-3.5 pr-3 w-3/5">Descripción</th>
                    <th scope="col" class="px-3 py-3.5 w-1/5">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr>
                    <!-- Stage descripction -->
                    <td
                      class="w-4/5 py-4 pr-3 text-sm font-medium text-primary sm:pl-0 break-words"
                    >
                    <input
                      type="text"
                      name="stage"
                      id="stage"
                      class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                    />
                    </td>
                    <!-- Actions buttons -->
                    <td
                      class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary flex gap-2"
                    >
                      <!-- Delete stage -->
                      <button>
                        <TrashIcon class="h-7 w-7 text-red-500"></TrashIcon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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
        <!-- Archive table -->
        <div class="qflow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div
              class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
            >
              <table class="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr class="text-left text-base font-regular text-primary">
                    <th scope="col" class="py-3.5 pr-3 w-3/5">Descripción</th>
                    <th scope="col" class="px-3 py-3.5 w-1/5">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr>
                    <!-- Stage descripction -->
                    <td
                      class="w-4/5 py-4 pr-3 text-sm font-medium text-primary sm:pl-0 break-words"
                    >
                      <input
                        type="text"
                        name="file"
                        id="file"
                        class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                      />
                    </td>
                    <!-- Actions buttons -->
                    <td
                      class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary flex gap-2"
                    >
                      <!-- See file -->
                      <button>
                        <EyeIcon class="h-7 w-7 text-primary"></EyeIcon>
                      </button>
                      <!-- Edit file -->
                      <button>
                        <PencilIcon class="h-7 w-7 text-primary"></PencilIcon>
                      </button>
                      <!-- Delete file -->
                      <button>
                        <TrashIcon class="h-7 w-7 text-red-500"></TrashIcon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <!-- Save button -->
      <div>
        <button
          @click="onSubmit"
          type="button"
          class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
        >
          <span class="hidden lg:block">Guardar</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { submitHandler } from "@/shared/submit_handler";
import { computed, onMounted, ref, reactive } from "vue";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@heroicons/vue/20/solid";
import { TrashIcon, EyeIcon, PencilIcon } from "@heroicons/vue/24/outline";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { useCaseTypeStore } from "@/stores/case_type";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";
import userAvatar from "@/assets/images/user_avatar.jpg";

const caseTypeStore = useCaseTypeStore();
const caseTypes = computed(() => caseTypeStore.caseTypes);

const userStore = useUserStore();
const clients = computed(() => userStore.clients);
console.log(clients);

const authStore = useAuthStore();

const formData = reactive({
  plaintiff: "",
  defendant: "",
  caseTypeId: "",
  subcase: "",
  ref: "",
  authority: "",
  clientId: "",
  lawyerId: "",
  states: [],
  caseFiles: [],
});

onMounted(async () => {
  await caseTypeStore.fetchCaseTypesData();
  await userStore.fetchUsersData();
});

// Handle form submission
const onSubmit = async () => {
  formData.caseTypeId = selectedCaseType.value.id;
  formData.clientId = selectedClient.value.id;
  formData.lawyerId = authStore.userAuth.id;

  const success = await submitHandler(
    formData,
    "Process information saved successfully!"
  );

  if (success) resetForm();
};

const resetForm = () => {
  formData.plaintiff = "";
  formData.defendant = "";
  formData.caseTypeId = "";
  formData.subcase = "";
  formData.ref = "";
  formData.authority = "";
  formData.clientId = "";
  formData.lawyerId = "";
  formData.states = [];
  formData.caseFiles = [];
};

const query = ref("");

const selectedCaseType = ref(null);
const filteredCaseTypes = computed(() =>
  query.value === ""
    ? caseTypes.value
    : caseTypes.value.filter((caseType) => {
        return caseType.type.toLowerCase().includes(query.value.toLowerCase());
      })
);

const selectedClient = ref(null);
const filteredClients = computed(() =>
  query.value === ""
    ? clients.value
    : clients.value.filter((client) => {
        return ["first_name", "last_name", "identification", "email"].some(
          (field) =>
            client[field]?.toLowerCase().includes(query.value.toLowerCase())
        );
      })
);
</script>
