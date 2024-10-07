<template>
  <!-- Replacing the old search bar with the new component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event" />

  <div class="flex-1">
    <!-- Directory by cards -->
    <div>
      <ul role="list" class="divide-y divide-gray-100 grid grid-cols-2">
        <li
          v-for="user in filteredUsers"
          :key="user.id"
          class="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6 lg:px-8"
        >
          <div
            class="flex min-w-0 gap-x-4 cursor-pointer"
            @click="navigateToProcessList(user.id)"
          >
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
                  <span class=" text-gray-400">
                    ({{ user.role == "client" ? "Cliente" : "Abogado" }})
                  </span>
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
</template>

<script setup>
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import { computed, onMounted, ref } from "vue";
import { useUserStore } from "@/stores/user";
import { ChevronRightIcon } from "@heroicons/vue/20/solid";

const userStore = useUserStore();
const searchQuery = ref("");

// Filter users based on search query
const filteredUsers = computed(() =>
  userStore.filteredUsers(searchQuery.value)
);

// Fetch users data on mount
onMounted(async () => {
  await userStore.init();
});

/**
 * Navigates to the process list view for a specific user.
 *
 * This method is used to navigate to the "process_list" view, passing the user ID
 * as a parameter to display processes associated with the selected user.
 *
 * @function navigateToProcessList
 * @param {number|string} userId - The ID of the user for whom the processes are to be displayed.
 * @returns {void}
 */
const navigateToProcessList = (userId) => {
  window.location.href = `${window.location.origin}/process_list/${userId}`;
};
</script>
