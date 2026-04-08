<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="px-4 sm:px-6 lg:px-8 py-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Administrar Servicios</h1>
        <p class="text-sm text-gray-600 mt-1">
          Crea, edita, activa/desactiva servicios y define formularios por etapas.
        </p>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div class="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900">Servicios</h2>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md bg-secondary text-white text-sm"
              @click="startCreate"
            >
              Nuevo
            </button>
          </div>

          <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            <button
              v-for="service in services"
              :key="service.id"
              type="button"
              class="w-full text-left rounded-lg border p-3"
              :class="selectedServiceId === service.id ? 'border-secondary bg-blue-50' : 'border-gray-200 bg-white'"
              @click="editService(service)"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900">{{ service.name }}</p>
                  <p class="text-xs text-gray-500">{{ service.short_title }}</p>
                </div>
                <div class="flex gap-1">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    :class="service.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ service.is_active ? "Activo" : "Inactivo" }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    :class="service.is_featured ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ service.is_featured ? "Destacado" : "Normal" }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">
            {{ selectedServiceId ? "Editar servicio" : "Nuevo servicio" }}
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input v-model="editor.name" type="text" placeholder="Nombre del servicio" class="rounded-md border border-gray-300 px-3 py-2" />
            <input v-model="editor.short_title" type="text" placeholder="Titulo corto (1-2 palabras)" class="rounded-md border border-gray-300 px-3 py-2" />
            <input v-model="editor.slug" type="text" placeholder="Slug (opcional)" class="rounded-md border border-gray-300 px-3 py-2" />
            <input v-model.number="editor.featured_order" type="number" min="0" class="rounded-md border border-gray-300 px-3 py-2" placeholder="Orden destacado" />
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input v-model="editor.is_active" type="checkbox" />
              Activo
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input v-model="editor.is_featured" type="checkbox" />
              Destacado
            </label>
          </div>

          <textarea
            v-model="editor.description"
            rows="3"
            placeholder="Descripcion"
            class="w-full rounded-md border border-gray-300 px-3 py-2 mb-4"
          ></textarea>

          <input type="file" class="w-full rounded-md border border-gray-300 px-3 py-2 mb-4" @change="onIconSelected" />

          <div class="space-y-4">
            <div
              v-for="(stage, stageIndex) in editor.stages"
              :key="`stage-${stageIndex}`"
              class="border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-900">Etapa {{ stageIndex + 1 }}</h3>
                <button type="button" class="text-xs text-red-600" @click="removeStage(stageIndex)">Eliminar etapa</button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input v-model="stage.title" type="text" placeholder="Titulo etapa" class="rounded-md border border-gray-300 px-3 py-2" />
                <input v-model.number="stage.order" type="number" min="1" placeholder="Orden" class="rounded-md border border-gray-300 px-3 py-2" />
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input v-model="stage.is_active" type="checkbox" />
                  Activa
                </label>
              </div>
              <textarea v-model="stage.description" rows="2" placeholder="Descripcion etapa" class="w-full rounded-md border border-gray-300 px-3 py-2 mb-3"></textarea>

              <div class="space-y-3">
                <div
                  v-for="(field, fieldIndex) in stage.fields"
                  :key="`field-${stageIndex}-${fieldIndex}`"
                  class="border border-gray-100 rounded-md p-3"
                >
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-semibold text-gray-700">Campo {{ fieldIndex + 1 }}</p>
                    <button type="button" class="text-xs text-red-600" @click="removeField(stageIndex, fieldIndex)">
                      Eliminar
                    </button>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <input v-model="field.key" type="text" placeholder="key_campo" class="rounded-md border border-gray-300 px-3 py-2" />
                    <input v-model="field.label" type="text" placeholder="Etiqueta" class="rounded-md border border-gray-300 px-3 py-2" />
                    <select v-model="field.field_type" class="rounded-md border border-gray-300 px-3 py-2">
                      <option value="input">Texto corto</option>
                      <option value="text_area">Texto largo</option>
                      <option value="number">Numero</option>
                      <option value="date">Fecha</option>
                      <option value="email">Correo</option>
                      <option value="select_single">Seleccion unica</option>
                      <option value="select_multiple">Seleccion multiple</option>
                      <option value="file">Archivo</option>
                    </select>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <input v-model.number="field.order" type="number" min="1" placeholder="Orden" class="rounded-md border border-gray-300 px-3 py-2" />
                    <input v-model="field.placeholder" type="text" placeholder="Placeholder" class="rounded-md border border-gray-300 px-3 py-2" />
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input v-model="field.is_required" type="checkbox" />
                      Obligatorio
                    </label>
                  </div>

                  <textarea v-model="field.help_text" rows="2" placeholder="Ayuda del campo" class="w-full rounded-md border border-gray-300 px-3 py-2"></textarea>

                  <div v-if="['select_single','select_multiple'].includes(field.field_type)" class="mt-2">
                    <input
                      v-model="field.options_text"
                      type="text"
                      placeholder="Opciones separadas por coma"
                      class="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div v-if="field.field_type === 'file'" class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <input
                      v-model="field.allowed_extensions_text"
                      type="text"
                      placeholder=".jpg,.png,.pdf"
                      class="rounded-md border border-gray-300 px-3 py-2"
                    />
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input v-model="field.allow_multiple_files" type="checkbox" />
                      Multiples archivos
                    </label>
                    <input
                      v-model.number="field.max_files"
                      type="number"
                      min="1"
                      class="rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Max archivos"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="mt-3 px-3 py-1.5 rounded-md border border-blue-300 text-blue-700 text-sm"
                @click="addField(stageIndex)"
              >
                + Agregar campo
              </button>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <button type="button" class="px-3 py-2 rounded-md border border-blue-300 text-blue-700" @click="addStage">
              + Agregar etapa
            </button>
            <button type="button" class="px-3 py-2 rounded-md bg-secondary text-white" @click="saveService">
              Guardar servicio
            </button>
            <button v-if="selectedServiceId" type="button" class="px-3 py-2 rounded-md border border-gray-300 text-gray-700" @click="toggleActive">
              {{ editor.is_active ? "Desactivar" : "Activar" }}
            </button>
            <button v-if="selectedServiceId" type="button" class="px-3 py-2 rounded-md border border-gray-300 text-gray-700" @click="toggleFeatured">
              {{ editor.is_featured ? "Quitar destacado" : "Marcar destacado" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { showNotification } from "@/shared/notification_message";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const store = useServicesTramitesStore();

const services = ref([]);
const selectedServiceId = ref(null);
const iconFile = ref(null);

const emptyField = () => ({
  key: "",
  label: "",
  field_type: "input",
  placeholder: "",
  help_text: "",
  is_required: false,
  order: 1,
  options_text: "",
  allowed_extensions_text: ".jpg,.png,.pdf",
  allow_multiple_files: false,
  max_files: 1,
});

const emptyStage = (order = 1) => ({
  title: "",
  description: "",
  order,
  is_active: true,
  fields: [emptyField()],
});

const editor = reactive({
  name: "",
  short_title: "",
  slug: "",
  description: "",
  is_active: true,
  is_featured: false,
  featured_order: 0,
  stages: [emptyStage(1)],
});

const resetEditor = () => {
  editor.name = "";
  editor.short_title = "";
  editor.slug = "";
  editor.description = "";
  editor.is_active = true;
  editor.is_featured = false;
  editor.featured_order = 0;
  editor.stages = [emptyStage(1)];
  selectedServiceId.value = null;
  iconFile.value = null;
};

const loadServices = async () => {
  try {
    services.value = await store.fetchAdminServices();
  } catch (error) {
    console.error("Error loading admin services:", error);
    services.value = [];
  }
};

const mapServiceToEditor = (service) => {
  editor.name = service.name || "";
  editor.short_title = service.short_title || "";
  editor.slug = service.slug || "";
  editor.description = service.description || "";
  editor.is_active = service.is_active;
  editor.is_featured = service.is_featured;
  editor.featured_order = service.featured_order || 0;
  editor.stages = (service.stages || []).map((stage, stageIndex) => ({
    id: stage.id || null,
    title: stage.title || "",
    description: stage.description || "",
    order: stage.order || stageIndex + 1,
    is_active: stage.is_active !== false,
    fields: (stage.fields || []).map((field, fieldIndex) => ({
      id: field.id || null,
      key: field.key || "",
      label: field.label || "",
      field_type: field.field_type || "input",
      placeholder: field.placeholder || "",
      help_text: field.help_text || "",
      is_required: field.is_required === true,
      order: field.order || fieldIndex + 1,
      options_text: Array.isArray(field.options) ? field.options.join(", ") : "",
      allowed_extensions_text: Array.isArray(field.allowed_extensions)
        ? field.allowed_extensions.join(", ")
        : ".jpg,.png,.pdf",
      allow_multiple_files: field.allow_multiple_files === true,
      max_files: field.max_files || 1,
    })),
  }));
};

const editService = (service) => {
  selectedServiceId.value = service.id;
  mapServiceToEditor(service);
  iconFile.value = null;
};

const startCreate = () => {
  resetEditor();
};

const onIconSelected = (event) => {
  iconFile.value = event.target.files?.[0] || null;
};

const addStage = () => {
  editor.stages.push(emptyStage(editor.stages.length + 1));
};

const removeStage = (stageIndex) => {
  if (editor.stages.length === 1) return;
  editor.stages.splice(stageIndex, 1);
};

const addField = (stageIndex) => {
  const stage = editor.stages[stageIndex];
  stage.fields.push(emptyField());
};

const removeField = (stageIndex, fieldIndex) => {
  const stage = editor.stages[stageIndex];
  if (stage.fields.length === 1) return;
  stage.fields.splice(fieldIndex, 1);
};

const buildPayload = () => ({
  name: editor.name,
  short_title: editor.short_title,
  slug: editor.slug || undefined,
  description: editor.description,
  is_active: editor.is_active,
  is_featured: editor.is_featured,
  featured_order: Number(editor.featured_order || 0),
  stages: editor.stages.map((stage) => {
    const stagePayload = {
      title: stage.title,
      description: stage.description,
      order: Number(stage.order || 1),
      is_active: stage.is_active,
      fields: stage.fields.map((field) => {
        const fieldPayload = {
          key: field.key,
          label: field.label,
          field_type: field.field_type,
          placeholder: field.placeholder || "",
          help_text: field.help_text || "",
          is_required: field.is_required,
          order: Number(field.order || 1),
          options: ["select_single", "select_multiple"].includes(field.field_type)
            ? field.options_text
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : null,
          allowed_extensions: field.field_type === "file"
            ? field.allowed_extensions_text
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : null,
          allow_multiple_files: field.field_type === "file" ? field.allow_multiple_files : false,
          max_files: field.field_type === "file" ? Number(field.max_files || 1) : 1,
        };
        if (field.id) fieldPayload.id = field.id;
        return fieldPayload;
      }),
    };
    if (stage.id) stagePayload.id = stage.id;
    return stagePayload;
  }),
});

const saveService = async () => {
  try {
    const payload = buildPayload();
    if (!payload.name || !payload.short_title || !payload.stages.length) {
      showNotification("Completa nombre, titulo corto y al menos una etapa", "warning");
      return;
    }

    let savedId = selectedServiceId.value;
    if (savedId) {
      await store.updateService(savedId, payload, iconFile.value);
      showNotification("Servicio actualizado", "success");
    } else {
      const created = await store.createService(payload, iconFile.value);
      savedId = created.id;
      showNotification("Servicio creado", "success");
    }

    await loadServices();
    const reloaded = services.value.find((s) => s.id === savedId);
    if (reloaded) {
      editService(reloaded);
    } else {
      resetEditor();
    }
  } catch (error) {
    console.error("Error saving service:", error);
    showNotification("No fue posible guardar el servicio", "warning");
  }
};

const toggleActive = async () => {
  if (!selectedServiceId.value) return;
  try {
    await store.toggleServiceActive(selectedServiceId.value);
    await loadServices();
    const selected = services.value.find((item) => item.id === selectedServiceId.value);
    if (selected) mapServiceToEditor(selected);
  } catch (error) {
    console.error("Error toggling active flag:", error);
    showNotification("No fue posible actualizar el estado activo", "warning");
  }
};

const toggleFeatured = async () => {
  if (!selectedServiceId.value) return;
  try {
    await store.toggleServiceFeatured(selectedServiceId.value);
    await loadServices();
    const selected = services.value.find((item) => item.id === selectedServiceId.value);
    if (selected) mapServiceToEditor(selected);
  } catch (error) {
    console.error("Error toggling featured flag:", error);
    showNotification("No fue posible actualizar el destacado", "warning");
  }
};

onMounted(loadServices);
</script>
