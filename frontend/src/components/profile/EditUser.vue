<template>
    <section>
        <form 
            class="max-w-md space-y-5 rounded-lg border-2 border-gray-700 p-4"
            @submit.prevent="updateProfile">
            <h2 class="font-bold">Edit User</h2>
            <div class="flex space-x-8">
                <div>
                    <label 
                        for="first_name" 
                        class="block mb-2 text-sm font-medium text-gray-900">
                        First name
                    </label>
                    <input
                        v-model="userAuth.first_name"
                        type="text" 
                        id="first_name" 
                        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"  
                        required />
                </div>
                <div>
                    <label 
                        for="last_name" 
                        class="block mb-2 text-sm font-medium text-gray-900">
                        Last name
                    </label>
                    <input
                        v-model="userAuth.last_name"
                        type="text" 
                        id="last_name" 
                        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" 
                        required />
                </div>
            </div>

            <div>
                <label 
                    for="email" 
                    class="block mb-2 text-sm font-medium text-gray-900">
                    Email address
                </label>
                <input
                    v-model="userAuth.email"
                    type="email" 
                    id="email" 
                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" 
                    required />
            </div> 

            <button 
                type="submit" 
                class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center">
                Edit User
            </button>
        </form>
    </section>
</template>

<script setup>
    import axios from 'axios';
    import { onMounted, reactive } from 'vue';
    import { useAuthStore } from '@/stores/auth';
    import { showNotification } from '@/shared/notification_message';

    const authStore = useAuthStore(); // Get the authentication store instance
    const userAuth = reactive({}); // Reactive object to store user authentication details

    // Run on component mount
    onMounted(() => {
        Object.assign(userAuth, authStore.userAuth); // Assign authStore's userAuth to userAuth reactive object
    });

    /**
     * Updates the user's profile with the current userAuth data.
     */
    const updateProfile = async () => {
        try {
            await axios.post('/api/update_profile/', userAuth); // Send POST request to update profile

            showNotification("Profile updated successfully!", "success"); // Show success showNotification
        } catch (error) {
            handleProfileUpdateError(error);
        }
    };

    /**
     * Handles errors during the profile update process.
     * @param {Object} error - The error object caught during profile update.
     */
    const handleProfileUpdateError = (error) => {
        console.error('Error during profile update:', error);
        showNotification("Profile update failed!", "error"); // Show error showNotification
    };
</script>