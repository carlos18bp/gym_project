<template>
  <!-- Content -->
  <div v-if="document" class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Document's name -->
      <div>
        <h1 class="text-primary text-xl font-semibold">{{ document.title }}</h1>
      </div>

      <!-- Dynamic form fields grid -->
      <div class="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div
          v-for="(variable, index) in document.variables"
          :key="index"
          :class="{
            'col-span-3': variable.field_type === 'text_area',
            'col-span-1': variable.field_type === 'input',
          }"
        >
          <div class="flex items-center gap-2">
            <label
              :for="'field-' + index"
              class="text-base font-medium text-primary"
            >
              {{ variable.name_es || variable.name_en }}
            </label>
            <div v-if="variable.tooltip" class="relative group">
              <InformationCircleIcon
                class="size-5 text-gray-400 hover:text-secondary cursor-pointer"
              />
              <div
                class="absolute hidden group-hover:block top-2 left-4 transform translate-y-[-100%] px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg"
                style="white-space: nowrap; z-index: 10"
              >
                {{ variable.tooltip }}
              </div>
            </div>
          </div>

          <input
            v-if="variable.field_type === 'input'"
            type="text"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
            :placeholder="variable.tooltip || 'Ingrese un valor'"
          />

          <textarea
            v-if="variable.field_type === 'text_area'"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
            :placeholder="variable.tooltip || 'Ingrese un texto largo'"
          ></textarea>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex space-x-4">
        <button
          type="button"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-secondary text-white"
          @click="saveDocument('Progress')"
        >
          {{ isEditMode ? 'Guardar Cambios' : 'Guardar' }}
        </button>
        <button
          type="button"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2"
          :class=" 
            !allFieldsComplete
            ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
            : 'bg-secondary text-white'
          "
          :disabled="!allFieldsComplete"
          @click="saveDocument('Completed')"
        >
          {{ isEditMode ? 'Completar' : 'Generar' }}
        </button>
        <button
            @click="handleBack()"
            type="button"
            class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-red-600/80 text-white cursor-pointer"
          >
            Cancelar
        </button>
        
      </div>
    </div>
  </div>
  <div v-else class="text-center text-gray-500">
    <p>Cargando documento...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";
import { showNotification } from '@/shared/notification_message';

const route = useRoute();
const router = useRouter();
const store = useDynamicDocumentStore();

const documentBase = ref(null);
const document = ref(null);

// Detect edit mode based on the presence of a document ID
const isEditMode = ref(false);

onMounted(async () => {
  const documentId = route.params.id;
  isEditMode.value = route.params.mode == 'editor' ? true : false;
  documentBase.value = await store.documentById(documentId); 

  if (route.params.mode == 'creator') {
    document.value = {
      title: route.params.title,
      variables: documentBase.value.variables,
      content: documentBase.value.content,
      created_by: documentBase.value.created_by,
      assigned_to: store.currentUser?.id || null,
    };
  }

  if (route.params.mode == 'editor') {  
    document.value = documentBase.value;
    document.value.title = route.params.title;
  }
});

const allFieldsComplete = computed(() => {
  return document.value?.variables.every(
    (variable) => variable.value && variable.value.trim().length > 0
  );
});

const saveDocument = async (state) => {
  try {
    document.value.state = state;
    document.value.assigned_to = store.currentUser?.id;

    console.log(isEditMode.value)
    if (isEditMode.value) {
      document.value.variables = 
        document.value.variables.map((variable) => ({
          id: variable.id,
          name_en: variable.name_en,
          name_es: variable.name_es,
          field_type: variable.field_type,
          value: variable.value,
        }));

      await store.updateDocument(document.value.id, document.value);

      await showNotification(
        state === "Completed" ? "Documento completado exitosamente" : "Documento actualizado.",
        "success"
      );
    } else {
      document.value.variables = 
        document.value.variables.map((variable) => ({
          name_en: variable.name_en,
          name_es: variable.name_es,
          field_type: variable.field_type,
          value: variable.value,
        }));
      await store.createDocument(document.value);

      await showNotification(
        state === "Completed" ? "Documento generado exitosamente" : "Documento guardado como borrador",
        "success"
      );

    }

    router.push("/dynamic_document_dashboard");
  } catch (error) {
    console.error("Error saving document:", error);
  }
};

const handleBack = () => {
  router.push('/dynamic_document_dashboard');
};
</script>
