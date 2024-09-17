<template>
  <SlideBar>
    <div class="flex-1">
      <!-- Search bar container -->
      <div class="w-full flex justify-end">
        <!-- Search bar -->
        <div class="w-full max-w-lg lg:max-w-xs">
          <label for="search" class="sr-only"> Buscar usuarios </label>
          <div class="relative">
            <div
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
            >
              <MagnifyingGlassIcon
                class="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              id="search"
              name="search"
              v-model="searchQuery"
              class="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
              placeholder="Buscar usuarios"
              type="search"
            />
          </div>
        </div>
      </div>
      <!-- Directory by cards -->
      <div class="grid grid-cols-2">
        <ul role="list" class="divide-y divide-gray-100">
          <li
            v-for="user in filteredUsers"
            :key="user.id"
            class="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6 lg:px-8"
          >
            <div class="flex min-w-0 gap-x-4 cursor-pointer">
              <img
                class="h-12 w-12 flex-none rounded-full bg-gray-50"
                v-if="user.photo_profile"
                :src="user.photo_profile"
                alt="Photo Profile"
              />
              <img
                class="h-12 w-12 flex-none rounded-full bg-gray-50"
                v-else
                src="@/assets/images/user_avatar.jpg"
                alt="Photo Profile"
              />
              <div class="min-w-0 flex-auto">
                <p class="text-sm font-semibold leading-6 text-gray-900">
                  <a>
                    <span class="absolute inset-x-0 -top-px bottom-0" />
                    {{ user.last_name }} {{ user.first_name }}
                  </a>
                </p>
                <p class="mt-1 flex text-xs leading-5 text-gray-500">
                  <a
                    :href="`mailto:${user.email}`"
                    class="relative truncate hover:underline"
                    >{{ user.email }}</a
                  >
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-x-4">
              <ChevronRightIcon
                class="h-5 w-5 flex-none text-gray-400"
                aria-hidden="true"
              />
            </div>
          </li>
        </ul>
      </div>
    </div>
  </SlideBar>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useUserStore } from "@/stores/user";
import SlideBar from "@/components/layouts/SlideBar.vue";
import { ChevronRightIcon, MagnifyingGlassIcon } from "@heroicons/vue/20/solid";

const userStore = useUserStore();
const users = ref([]);
const searchQuery = ref("");

const filteredUsers = computed(() => userStore.filteredUsers(searchQuery.value));

onMounted(async () => {
    await userStore.fetchUsersData();
    users.value = userStore.users;
});

</script>
