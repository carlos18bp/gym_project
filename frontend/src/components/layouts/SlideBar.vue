<template>
  <TransitionRoot as="template" :show="slidebarOpen">
    <Dialog class="relative z-50 lg:hidden" @close="slidebarOpen = false">
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
                  @click="slidebarOpen = false"
                >
                  <span class="sr-only">Cerrar slidebar</span>
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
              <nav class="relative flex flex-1 flex-col">
                <ul role="list" class="flex flex-1 flex-col gap-y-5">
                  <li>
                    <!-- Profile dropdown -->
                    <Menu as="div" class="relative">
                      <MenuButton class="-m-1.5 flex items-center p-1.5">
                        <span class="sr-only">Abrir menú de usuario</span>
                        <img
                          class="h-8 w-8 rounded-full bg-gray-50 object-cover object-center"
                          :src="currentUser.photo_profile || userAvatar"
                          alt="Phone Profile"
                        />
                        <span class="flex items-center">
                          <span
                            class="ml-4 text-sm font-semibold leading-6 text-gray-900 truncate max-w-44"
                            aria-hidden="true"
                          >
                            {{ currentUser.first_name }}
                            {{ currentUser.last_name }}
                          </span>
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
                          :href="item.href || 'javascript:void(0)'"
                          :target="item.target || null"
                          @click="!item.href && item.action(item)"
                          class="cursor-pointer"
                          :class="[
                            item.current
                              ? 'bg-gray-50 text-secondary'
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
                      <PWAInstallButton></PWAInstallButton>
                    </ul>
                  </li>
                </ul>
                <!-- Social Networks Buttons -->
                <div class="absolute bottom-0 w-full flex gap-0.5 items-center">
                  <a 
                    href="https://api.whatsapp.com/message/XR7PDKOQS3R6A1?autoload=1&app_absent=0" 
                    target="_blank" 
                    class="cursor-pointer"
                  >
                    <img :src="WhatsappIcon">
                  </a>
                  <a 
                    href="https://www.instagram.com/gymconsultoresjuridicos/" 
                    target="_blank" 
                    class="cursor-pointer"
                  >
                    <img :src="InstagramIcon">
                  </a>
                  <a 
                    href="https://www.facebook.com/profile.php?id=100089865602579&mibextid=ZbWKwL" 
                    target="_blank" 
                    class="-mt-2 cursor-pointer"
                  >
                    <img :src="FacebookIcon">
                  </a>
                </div>
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
      <nav class="relative flex flex-1 flex-col">
        <ul role="list" class="flex flex-1 flex-col gap-y-5">
          <li>
            <!-- Profile dropdown -->
            <Menu as="div" class="relative">
              <MenuButton class="-m-1.5 flex items-center p-1.5">
                <span class="sr-only">Open user menu</span>
                <img
                  class="h-8 w-8 rounded-full bg-gray-50 object-cover object-center"
                  :src="currentUser.photo_profile || userAvatar"
                  alt="Phone Profile"
                />
                <span class="hidden lg:flex lg:items-center">
                  <span
                    class="ml-4 text-sm font-semibold leading-6 text-gray-900 truncate max-w-44"
                    aria-hidden="true"
                    >{{ currentUser.first_name }}
                    {{ currentUser.last_name }}</span
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
                  :href="item.href || 'javascript:void(0)'"
                  :target="item.target || null"
                  @click="!item.href && item.action(item)"
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
              <PWAInstallButton></PWAInstallButton>
            </ul>
          </li>
        </ul>
        <!-- Social Networks Buttons -->
        <div class="absolute bottom-0 w-full flex gap-0.5 items-center">
          <a 
            href="https://api.whatsapp.com/message/XR7PDKOQS3R6A1?autoload=1&app_absent=0" 
            target="_blank" 
            class="cursor-pointer"
          >
            <img :src="WhatsappIcon">
          </a>
          <a 
            href="https://www.instagram.com/gymconsultoresjuridicos/" 
            target="_blank" 
            class="cursor-pointer"
          >
            <img :src="InstagramIcon">
          </a>
          <a 
            href="https://www.facebook.com/profile.php?id=100089865602579&mibextid=ZbWKwL" 
            target="_blank" 
            class="-mt-2 cursor-pointer"
          >
            <img :src="FacebookIcon">
          </a>
        </div>
      </nav>
    </div>
  </div>

  <div class="lg:pl-72 w-full h-screen flex-1 flex flex-col">
    <main class="h-full">
      <!-- Content -->
      <router-view v-slot="{ Component }">
        <component :is="Component">
          <template #default>
            <button
              type="button"
              class="-m-2.5 p-2.5 text-gray-700 lg:hidden"
              @click="slidebarOpen = true"
            >
              <span class="sr-only">Open sidebar</span>
              <Bars3Icon class="h-6 w-6" aria-hidden="true" />
            </button>
          </template>
        </component>
      </router-view>
    </main>
  </div>
  <!-- Profile modal information -->
  <Profile
    :currentUser="currentUser"
    :visible="showProfile"
    @update:visible="showProfile = $event"
  >
  </Profile>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import Profile from "@/components/user/Profile.vue";
import PWAInstallButton from "@/components/pwa/PWAInstallButton.vue";
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
  CalendarDaysIcon,
  PencilSquareIcon,
  ScaleIcon,
  HomeIcon,
  XMarkIcon,
  ClockIcon,
  Bars3Icon,
  InboxArrowDownIcon,
  UsersIcon
} from "@heroicons/vue/24/outline";
import { ChevronDownIcon } from "@heroicons/vue/20/solid";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";
import { googleLogout } from "vue3-google-login";
import userAvatar from "@/assets/images/user_avatar.jpg";
import WhatsappIcon from "@/assets/icons/social_network/whatsapp.svg";
import FacebookIcon from "@/assets/icons/social_network/facebook.svg";
import InstagramIcon from "@/assets/icons/social_network/instagram.svg";

const router = useRouter();
const authStore = useAuthStore(); // Get the authentication store instance
const userStore = useUserStore();
const currentUser = reactive({});

const showProfile = ref(false); // Show modal with profile information
const slidebarOpen = ref(false); // Show modal with navigation

onMounted(async () => {
  await userStore.init();
  Object.assign(currentUser, userStore.userById(authStore.userAuth.id));
  showProfile.value = !!!currentUser.is_profile_completed;

  // Filter out the "Radicar Proceso" option if the user role is "client"
  if (currentUser.role == "client") {
    navigation.value = navigation.value.filter(
      (navItem) =>
        navItem.name !== "Radicar Proceso" && 
        navItem.name !== "Directorio" && 
        navItem.name !== "Intranet G&M"
    );
  } else if (currentUser.role == "lawyer" && !currentUser.is_gym_lawyer) {
    // Remove "Intranet G&M" for lawyers who are not GYM lawyers
    navigation.value = navigation.value.filter(
      (navItem) => navItem.name !== "Intranet G&M"
    );
  }

  // Filter out the "Solicitudes" option if the user role is "lawyer" or is_gym_lawyer
  if (currentUser.role === "lawyer" || currentUser.is_gym_lawyer) {
    navigation.value = navigation.value.filter(
      (navItem) => 
        navItem.name !== "Solicitudes" &&
        navItem.name !== "Agendar Cita"
    );
  }
});


/**
 * Logs out the user by clearing the auth store and logging out from Google.
 */
const logOut = () => {
  authStore.logout(); // Log out from the auth store
  googleLogout(); // Log out from Google
  router.push({ name: "sign_in" });
};

/**
 * Shows to profile modal.
 */
const goProfile = () => {
  slidebarOpen.value = false;
  showProfile.value = true;
};

/**
 * Navigation items for the sidebar menu.
 *
 * This array contains objects representing different navigation items in the sidebar menu.
 * Each object has the following properties:
 * - `name` {string}: The display name of the navigation item.
 * - `action` {function|null}: The function to execute when the item is clicked. If `null`, no action is taken.
 * - `icon` {Component}: The icon component to display next to the navigation item name.
 * - `current` {boolean}: Indicates if the navigation item is currently active (true) or not (false).
 *
 * @constant {Array<Object>}
 */
const navigation = ref([
  {
    name: "Procesos",
    action: (item) => {
      setCurrent(item);
      router.push({
        name: "process_list",
        params: { user_id: "", display: "" },
      });
    },
    icon: HomeIcon,
    current: true,
  },
  {
    name: "Directorio",
    action: (item) => {
      setCurrent(item);
      router.push({ name: "directory_list" });
    },
    icon: UsersIcon,
    current: false,
  },
  {
    name: "Solicitudes",
    action: (item) => {
      setCurrent(item);
      router.push({ name: "legal_request" });
    },
    icon: InboxArrowDownIcon,
    current: false,
  },
  {
    name: "Agendar Cita",
    action: (item) => {
      setCurrent(item);
      router.push({ name: "schedule_appointment" });
    },
    icon: CalendarDaysIcon,
    current: false,
  },
  {
    name: "Radicar Proceso",
    action: (item) => {
      setCurrent(item);
      router.push({
        name: "process_form",
        params: { action: "add", process_id: "" },
      });
    },
    icon: PencilSquareIcon,
    current: false,
  },
  {
    name: "Intranet G&M",
    action: (item) => {
      setCurrent(item);
      router.push({ name: "intranet_g_y_m" });
    },
    icon: ScaleIcon,
    current: false,
  },
  {
    name: "Archivados",
    action: (item) => {
      setCurrent(item);
      router.push({
        name: "process_list",
        params: { user_id: "", display: "history" },
      });
    },
    icon: ClockIcon,
    current: false,
  },
]);

/**
 * User navigation items for the user menu.
 *
 * This array contains objects representing different actions available to the user in the user menu.
 * Each object has the following properties:
 * - `name` {string}: The display name of the user menu item.
 * - `action` {function|null}: The function to execute when the item is clicked. If `null`, no action is taken.
 *
 * @constant {Array<Object>}
 */
const userNavigation = [
  {
    name: "Perfil",
    action: goProfile,
  },
  {
    name: "Cerrar sesión",
    action: logOut,
  },
];


/**
 * Sets the current navigation item as active.
 *
 * This function iterates through the `navigation` items, setting the `current` property of each item to `false`.
 * Then, it sets the `current` property of the provided `item` to `true`, marking it as the active navigation item.
 *
 * @function setCurrent
 * @param {Object} item - The navigation item object to set as active.
 * @returns {void}
 */
const setCurrent = (item) => {
  navigation.value.forEach((navItem) => {
    navItem.current = false;
  });

  item.current = true;
  slidebarOpen.value = false;
};
</script>
