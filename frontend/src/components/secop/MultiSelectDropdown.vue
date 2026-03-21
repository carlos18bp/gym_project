<template>
  <div class="relative" ref="containerRef">
    <button
      type="button"
      @click="toggle"
      :data-testid="dataTestid"
      :class="[
        'w-full inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors',
        modelValue.length > 0
          ? 'border-2 border-secondary bg-blue-50/50 text-secondary'
          : 'border border-gray-300 bg-white text-gray-700',
      ]"
    >
      <div class="flex items-center gap-2 min-w-0">
        <FunnelIcon class="h-4 w-4 flex-shrink-0 text-gray-400" />
        <span class="truncate">
          {{ displayLabel }}
        </span>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <span
          v-if="modelValue.length > 0"
          class="inline-flex items-center justify-center rounded-full bg-secondary text-white text-xs font-bold h-5 min-w-[20px] px-1"
          data-testid="selected-count"
        >
          {{ modelValue.length }}
        </span>
        <ChevronDownIcon
          :class="['h-4 w-4 text-gray-400 transition-transform', isOpen ? 'rotate-180' : '']"
        />
      </div>
    </button>

    <!-- Dropdown panel -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 z-20 mt-2 w-72 origin-top-left rounded-xl bg-white shadow-lg ring-1 ring-gray-200 focus:outline-none"
        data-testid="dropdown-panel"
      >
        <!-- Search input -->
        <div class="p-2 border-b border-gray-100">
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref="searchInputRef"
              v-model="searchTerm"
              type="text"
              :placeholder="`Buscar ${placeholder.toLowerCase()}...`"
              class="w-full rounded-lg border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-secondary focus:border-secondary"
              data-testid="dropdown-search"
            />
          </div>
        </div>

        <!-- Select all / Clear -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <button
            type="button"
            @click="selectAll"
            class="text-xs font-medium text-secondary hover:text-blue-800 transition-colors"
            data-testid="select-all-btn"
          >
            Seleccionar todo
          </button>
          <button
            type="button"
            @click="clearAll"
            class="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            data-testid="clear-all-btn"
          >
            Limpiar
          </button>
        </div>

        <!-- Options list -->
        <div class="max-h-60 overflow-y-auto py-1" data-testid="dropdown-options">
          <div
            v-if="filteredOptions.length === 0"
            class="px-4 py-3 text-sm text-gray-400 text-center"
          >
            Sin resultados
          </div>
          <label
            v-for="option in filteredOptions"
            :key="option"
            class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-terciary transition-colors"
          >
            <input
              type="checkbox"
              :checked="modelValue.includes(option)"
              @change="toggleOption(option)"
              class="h-4 w-4 rounded border-gray-300 text-secondary focus:ring-secondary"
              :data-testid="`option-${option}`"
            />
            <span
              :class="[
                'text-sm truncate',
                modelValue.includes(option) ? 'font-semibold text-secondary' : 'text-gray-700',
              ]"
            >
              {{ option }}
            </span>
          </label>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { FunnelIcon, ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: "Seleccionar",
  },
  dataTestid: {
    type: String,
    default: "multi-select",
  },
});

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const searchTerm = ref("");
const containerRef = ref(null);
const searchInputRef = ref(null);

const displayLabel = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder;
  if (props.modelValue.length === 1) return props.modelValue[0];
  return `${props.modelValue.length} seleccionados`;
});

const filteredOptions = computed(() => {
  if (!searchTerm.value) return props.options;
  const term = searchTerm.value.toLowerCase();
  return props.options.filter((opt) => opt.toLowerCase().includes(term));
});

function toggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchTerm.value = "";
    nextTick(() => searchInputRef.value?.focus());
  }
}

function toggleOption(option) {
  const current = [...props.modelValue];
  const idx = current.indexOf(option);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(option);
  }
  emit("update:modelValue", current);
}

function selectAll() {
  emit("update:modelValue", [...filteredOptions.value]);
}

function clearAll() {
  emit("update:modelValue", []);
}

function handleClickOutside(event) {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
