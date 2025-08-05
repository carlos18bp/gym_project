<template>
  <Menu as="div" class="relative inline-block text-left menu-container">
    <MenuButton class="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-0">
      <EllipsisVerticalIcon class="w-5 h-5" aria-hidden="true" />
    </MenuButton>
    
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <MenuItems
        class="absolute z-50 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        :class="menuPosition"
      >
        <div class="py-1">
          <!-- Render menu items or groups -->
          <template v-for="item in menuItems" :key="item.id || item.label">
            <!-- Simple menu item -->
            <MenuItem v-if="!item.children">
              <button
                class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0"
                :disabled="item.disabled"
                @click="handleMenuAction(item.action)"
                :class="{
                  'opacity-50 cursor-not-allowed': item.disabled,
                  'cursor-pointer': !item.disabled,
                }"
              >
                <NoSymbolIcon
                  v-if="item.disabled"
                  class="size-5 text-gray-400 inline mr-2"
                  aria-hidden="true"
                />
                {{ item.label }}
              </button>
            </MenuItem>
            <!-- Group with submenu -->
            <div v-else class="submenu-container relative">
              <MenuItem>
                <div
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition cursor-pointer flex items-center justify-between"
                  @mouseenter="showSubmenu(item.id)"
                  @mouseleave="hideSubmenu(item.id)"
                >
                  <div class="flex items-center">
                    {{ item.label }}
                  </div>
                  <ChevronRightIcon class="w-4 h-4 text-gray-400" />
                </div>
              </MenuItem>

              <!-- Submenu -->
              <transition
                enter-active-class="transition ease-out duration-150"
                enter-from-class="transform opacity-0 translate-x-2 scale-95"
                enter-to-class="transform opacity-100 translate-x-0 scale-100"
                leave-active-class="transition ease-in duration-100"
                leave-from-class="transform opacity-100 translate-x-0 scale-100"
                leave-to-class="transform opacity-0 translate-x-2 scale-95"
              >
                <div
                  v-if="activeSubmenu === item.id"
                  class="absolute left-full top-0 mt-0 w-52 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-60"
                  @mouseenter="showSubmenu(item.id)"
                  @mouseleave="hideSubmenu(item.id)"
                >
                  <div class="py-1">
                    <button
                      v-for="child in item.children"
                      :key="child.label"
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0"
                      :disabled="child.disabled"
                      @click="handleMenuAction(child.action)"
                      :class="{
                        'opacity-50 cursor-not-allowed': child.disabled,
                        'cursor-pointer': !child.disabled,
                      }"
                    >
                      <NoSymbolIcon
                        v-if="child.disabled"
                        class="size-4 text-gray-400 inline mr-2"
                        aria-hidden="true"
                      />
                      {{ child.label }}
                    </button>
                  </div>
                </div>
              </transition>
            </div>
            <!-- Divider if specified -->
            <div v-if="item.divider" class="border-t border-gray-100"></div>
          </template>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup>
import { ref } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { 
  EllipsisVerticalIcon, 
  ChevronRightIcon,
  NoSymbolIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  menuItems: {
    type: Array,
    required: true,
    default: () => []
  },
  menuPosition: {
    type: String,
    default: 'right-0 left-auto sm:left-0 sm:right-auto'
  }
});

const emit = defineEmits(['menu-action']);

const activeSubmenu = ref(null);
let submenuTimeout = null;

const showSubmenu = (id) => {
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
  activeSubmenu.value = id;
};

const hideSubmenu = (id) => {
  submenuTimeout = setTimeout(() => {
    if (activeSubmenu.value === id) {
      activeSubmenu.value = null;
    }
  }, 150); // Small delay to allow mouse movement between menu and submenu
};

const handleMenuAction = (action) => {
  activeSubmenu.value = null; // Close submenus
  emit('menu-action', action);
};
</script>

<style scoped>
.submenu-container {
  position: relative;
}

/* Ensure submenus appear above other content */
.z-60 {
  z-index: 60;
}
</style>