<template>
  <!-- Replacing the old search bar with the new component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <template #auxiliary_button>
        <!-- Create Button for admin -->
        <button
            v-if="currentUser?.role === 'lawyer'"
            class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-secondary text-white"
            @click="showCreateContractModal = true">
          <div class="flex gap-1 items-center"> 
            <PlusIcon class="text-white font-bold size-6"></PlusIcon>
            <span>Nuevo</span>
        </div>
        </button>
    </template>
  </SearchBarAndFilterBy>
  <!-- Main content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <!-- Contracts Navigation -->
    <ContractsNavigation 
      @openNewContract="showCreateContractModal = true"
      @updateCurrentSection="handleSection"
      :role="currentUser.role"></ContractsNavigation
    >

    <!--Contracts sections depending on the user's role-->
    <div v-if="currentUser?.role === 'lawyer'">
        <ContractFinishedByClientList @show-send-contract-modal="showSendContractViaEmailModal = true" v-if="currentSection === 'contractFinished'"></ContractFinishedByClientList>
        <ContractInProgressByClientList v-if="currentSection === 'contractInProgress'"></ContractInProgressByClientList>
        <ContractListLawyer v-if="currentSection === 'default'"></ContractListLawyer>
    </div>
    <div v-if="currentUser?.role === 'client'">
        <ContractListClient></ContractListClient>
    </div>
  </div>

  <!-- Show create contract model for lawyer -->
  <ModalTransition v-show="showCreateContractModal">
    <CreateContractByLawyer @close="closeModal" />
  </ModalTransition>

  <!-- Show send contract via email model -->
  <ModalTransition v-show="showSendContractViaEmailModal">
    <SendContract @close="closeModal"></SendContract>
  </ModalTransition>
</template>

<script setup>
import { PlusIcon } from "@heroicons/vue/24/outline";
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import ContractsNavigation from "@/components/dynamic_document/layouts/ContractsNavigation.vue";
import ContractListClient from "@/components/dynamic_document/client/ContractListClient.vue";
import ContractListLawyer from "@/components/dynamic_document/lawyer/ContractListLawyer.vue";
import ContractFinishedByClientList from "@/components/dynamic_document/lawyer/ContractFinishedByClientList.vue";
import ContractInProgressByClientList from "@/components/dynamic_document/lawyer/ContractInProgressByClientList.vue";
import CreateContractByLawyer from "@/components/dynamic_document/lawyer/modals/CreateContractByLawyer.vue";
import SendContract from "@/components/dynamic_document/layouts/modals/SendContract.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { useUserStore } from "@/stores/user";
import { onMounted, computed, ref } from "vue";

// Store reference to user information
const userStore = useUserStore();

// Computed property to get the current authenticated user
const currentUser = computed(() => userStore.getCurrentUser);

// Reactive reference to track the current section in the navigation
const currentSection = ref("default");

// Reactive references to manage modal visibility
const showCreateContractModal = ref(false);
const showSendContractViaEmailModal = ref(false);

// Lifecycle hook: executed when the component is mounted
// Fetches and sets the current user data from the store
onMounted(async () => {
  await userStore.setCurrentUser();
});

// Function to handle section changes in the contract navigation
// Updates the value of 'currentSection' based on the message received
const handleSection = (message) => {
  currentSection.value = message;
};

// Function to close all open modals
// Resets the visibility of both 'Create Contract' and 'Send Contract' modals
function closeModal() {
  showCreateContractModal.value = false;
  showSendContractViaEmailModal.value = false;
}
</script>
