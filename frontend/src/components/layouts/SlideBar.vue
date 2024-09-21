<template>
  <TransitionRoot as="template" :show="sidebarOpen">
    <Dialog class="relative z-50 lg:hidden" @close="sidebarOpen = false">
      <TransitionChild
        as="template"
        enter="transition-opacity ease-linear duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="transition-opacity ease-linear duration-300"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/80" />
      </TransitionChild>

      <div class="fixed inset-0 flex">
        <TransitionChild
          as="template"
          enter="transition ease-in-out duration-300 transform"
          enter-from="-translate-x-full"
          enter-to="translate-x-0"
          leave="transition ease-in-out duration-300 transform"
          leave-from="translate-x-0"
          leave-to="-translate-x-full"
        >
          <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
            <TransitionChild
              as="template"
              enter="ease-in-out duration-300"
              enter-from="opacity-0"
              enter-to="opacity-100"
              leave="ease-in-out duration-300"
              leave-from="opacity-100"
              leave-to="opacity-0"
            >
              <div
                class="absolute left-full top-0 flex w-16 justify-center pt-5"
              >
                <button
                  type="button"
                  class="-m-2.5 p-2.5"
                  @click="sidebarOpen = false"
                >
                  <span class="sr-only">Close sidebar</span>
                  <XMarkIcon class="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
            </TransitionChild>
            <!-- Sidebar component, swap this element with another sidebar if you like -->
            <div
              class="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4"
            >
              <div class="flex h-18 shrink-0 items-center justify-center">
                <img
                  class="h-16 w-auto"
                  src="@/assets/images/logo/logo1.png"
                  alt="G&M Consultores Juridicos"
                />
              </div>
              <nav class="flex flex-1 flex-col">
                <ul role="list" class="flex flex-1 flex-col gap-y-5">
                  <li>
                    <!-- Profile dropdown -->
                    <Menu as="div" class="relative">
                      <MenuButton class="-m-1.5 flex items-center p-1.5">
                        <span class="sr-only">Open user menu</span>
                        <img
                          class="h-8 w-8 rounded-full bg-gray-50"
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                          alt=""
                        />
                        <span class="flex items-center">
                          <span
                            class="ml-4 text-sm font-semibold leading-6 text-gray-900"
                            aria-hidden="true"
                            >Tom Cook</span
                          >
                          <ChevronDownIcon
                            class="ml-2 h-5 w-5 text-gray-400"
                            aria-hidden="true"
                          />
                        </span>
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
                          class="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
                        >
                          <MenuItem
                            v-for="item in userNavigation"
                            :key="item.name"
                            v-slot="{ active }"
                          >
                            <a
                              @click="item.action"
                              class="cursor-pointer"
                              :class="[
                                active ? 'bg-gray-50' : '',
                                'block px-3 py-1 text-sm leading-6 text-gray-900',
                              ]"
                              >
                              {{ item.name }}
                            </a>
                          </MenuItem>
                        </MenuItems>
                      </transition>
                    </Menu>
                  </li>
                  <li>
                    <ul role="list" class="-mx-2 space-y-1">
                      <li v-for="item in navigation" :key="item.name">
                        <a
                          @click="item.action(item)"
                          class="cursor-pointer"
                          :class="[
                            item.current
                              ? 'bg-gray-50 text-secondary'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-secondary',
                            'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                          ]"
                        >
                          <component
                            :is="item.icon"
                            :class="[
                              item.current
                                ? 'text-secondary'
                                : 'text-gray-400 group-hover:text-secondary',
                              'h-6 w-6 shrink-0',
                            ]"
                            aria-hidden="true"
                          />
                          {{ item.name }}
                        </a>
                      </li>
                    </ul>
                  </li>
                  <li class="mt-auto">
                    <a class="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-secondary">
                      <QuestionMarkCircleIcon
                        class="h-6 w-6 shrink-0 text-gray-400 group-hover:text-secondary"
                        aria-hidden="true"
                      />
                      Soporte
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>

  <!-- Static sidebar for desktop -->
  <div class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
    <!-- Sidebar component, swap this element with another sidebar if you like -->
    <div
      class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4"
    >
      <div class="flex h-24 shrink-0 items-center justify-center">
        <img
          class="h-22 w-auto"
          src="@/assets/images/logo/logo1.png"
          alt="G&M Consultores Juridicos"
        />
      </div>
      <nav class="flex flex-1 flex-col">
        <ul role="list" class="flex flex-1 flex-col gap-y-5">
          <li>
            <!-- Profile dropdown -->
            <Menu as="div" class="relative">
              <MenuButton class="-m-1.5 flex items-center p-1.5">
                <span class="sr-only">Open user menu</span>
                <img
                  class="h-8 w-8 rounded-full bg-gray-50"
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt=""
                />
                <span class="hidden lg:flex lg:items-center">
                  <span
                    class="ml-4 text-sm font-semibold leading-6 text-gray-900"
                    aria-hidden="true"
                    >Tom Cook</span
                  >
                  <ChevronDownIcon
                    class="ml-2 h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
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
                  class="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none"
                >
                  <MenuItem
                    v-for="item in userNavigation"
                    :key="item.name"
                    v-slot="{ active }"
                  >
                    <a
                      @click="item.action"
                      class="cursor-pointer"
                      :class="[
                        active ? 'bg-gray-50' : '',
                        'block px-3 py-1 text-sm leading-6 text-gray-900',
                      ]"
                      >{{ item.name }}
                    </a>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </li>
          <li>
            <ul role="list" class="-mx-2 space-y-1">
              <li v-for="item in navigation" :key="item.name">
                <a
                  @click="item.action(item)"
                  class="cursor-pointer"
                  :class="[
                    item.current
                      ? 'bg-selected-background text-secondary'
                      : 'text-primary hover:bg-gray-50 hover:text-secondary',
                    'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                  ]"
                >
                  <component
                    :is="item.icon"
                    :class="[
                      item.current
                        ? 'text-secondary'
                        : 'text-primary group-hover:text-secondary',
                      'h-6 w-6 shrink-0',
                    ]"
                    aria-hidden="true"
                  />
                  {{ item.name }}
                </a>
              </li>
            </ul>
          </li>
          <li class="mt-auto">
            <a
              href="#"
              class="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-primary hover:bg-gray-50 hover:text-secondary"
            >
              <QuestionMarkCircleIcon
                class="h-6 w-6 shrink-0 text-primary group-hover:text-secondary"
                aria-hidden="true"
              />
              Soporte
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </div>

  <div class="lg:pl-72 w-full h-screen flex-1 flex flex-col">
    <div
      class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"
    >
      <button
        type="button"
        class="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        @click="sidebarOpen = true"
      >
        <span class="sr-only">Open sidebar</span>
        <Bars3Icon class="h-6 w-6" aria-hidden="true" />
      </button>

      <!-- Separator -->
      <div class="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form class="relative flex flex-1" action="#" method="GET">
          <label for="search-field" class="sr-only">Buscar</label>
          <MagnifyingGlassIcon
            class="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="search-field"
            class="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Buscar"
            type="search"
            name="search"
          />
        </form>
        <div class="flex items-center gap-x-6 font-medium">
          <button
            type="button"
            class="-m-2.5 p-2.5 text-primary hover:text-gray-500 flex gap-2"
          >
            <span class="hidden lg:block">Filtrar por</span>
            <ChevronDownIcon
              class="hidden lg:block h-6 w-6"
              aria-hidden="true"
            />
            <AdjustmentsHorizontalIcon
              class="block lg:hidden h-6 w-6"
              aria-hidden="true"
            />
          </button>

          <!-- Separator -->
          <div
            class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
            aria-hidden="true"
          />

          <!-- Add Process -->
          <button
            type="button"
            class="-m-2.5 p-2.5 text-base text-white bg-secondary rounded-md flex gap-2"
          >
            <PlusIcon class="h-6 w-6" aria-hidden="true" />
            <span class="hidden lg:block">Radicar Proceso</span>
          </button>
        </div>
      </div>
    </div>
    <main class="py-10 px-4 flex flex-1 sm:px-6 lg:px-8">
      <!-- Content -->
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue";
import {
  Dialog,
  DialogPanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import {
  AdjustmentsHorizontalIcon,
  Bars3Icon,
  CalendarIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  QuestionMarkCircleIcon,
  PencilSquareIcon,
  FolderIcon,
  HomeIcon,
  XMarkIcon,
  ClockIcon,
  PlusIcon,
} from "@heroicons/vue/24/outline";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/vue/20/solid";
import { useRouter } from 'vue-router';
import { useAuthStore } from "@/stores/auth";
import { googleLogout } from "vue3-google-login";

const router = useRouter();
const authStore = useAuthStore(); // Get the authentication store instance

/**
 * Logs out the user by clearing the auth store and logging out from Google.
 */
const logOut = () => {
  authStore.logout(); // Log out from the auth store
  googleLogout(); // Log out from Google
  router.push({ name: 'home' });
};

const navigation = ref([
  { 
    name: "Procesos", 
    action: (item) => {
      setCurrent(item)
      router.push({ name: 'process_list' })
    },
    icon: HomeIcon, 
    current: true 
  },
  { 
    name: "Directorio", 
    action: (item) => {
      setCurrent(item)
      router.push({ name: 'directory_list' })
    },
    icon: FolderIcon, 
    current: false 
  },
  { 
    name: "Agenda", 
    action: null,
    icon: CalendarIcon, 
    current: false 
  },
  {
    name: "Radicar Proceso",
    action: (item) => {
      setCurrent(item)
      router.push({ name: 'process_form' })
    },
    icon: PencilSquareIcon,
    current: false,
  },
  {
    name: "Chat",
    action: null,
    icon: ChatBubbleOvalLeftEllipsisIcon,
    current: false,
  },
  { 
    name: "Historial", 
    action: (item) => {
      setCurrent(item)
      router.push({ name: 'process_list', params: { display: 'history' } })
    },
    icon: ClockIcon, 
    current: false 
  },
]);

const userNavigation = [
  { 
    name: "Your profile", 
    action: null,
  },
  { 
    name: "Sign out", 
    action: logOut, 
  },
];

const sidebarOpen = ref(false);

const setCurrent = (item) => {
  navigation.value.forEach(navItem => {
    navItem.current = false;
  });

  item.current = true;
  console.log(item)
  console.log(navigation.value)
};
</script>
