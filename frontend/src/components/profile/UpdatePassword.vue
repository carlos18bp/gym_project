<template>
    <section>
        <form 
            class="max-w-md space-y-5 rounded-lg border-2 border-gray-700 p-4"
            @submit.prevent="updatePassword">
            <h2 class="font-bold">Update Password</h2>

            <div>
                <label 
                    for="current_password" 
                    class="block mb-2 text-sm font-medium text-gray-900">
                    Current Password
                </label>
                <input
                    v-model="passwords.currentPassword"
                    type="password"
                    id="current_password" 
                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                    required />
            </div>

            <div>
                <label 
                    for="new_password" 
                    class="block mb-2 text-sm font-medium text-gray-900">
                    New Password
                </label>
                <input
                    v-model="passwords.newPassword"
                    type="password" 
                    id="new_password" 
                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                    required />
            </div>

            <div>
                <label 
                    for="confirm_password" 
                    class="block mb-2 text-sm font-medium text-gray-900">
                    Confirm Password
                </label>
                <input
                    v-model="passwords.confirmPassword"
                    type="password" 
                    id="confirm_password" 
                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                    required />
            </div>

            <button 
                type="submit" 
                class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center">
                Update Password
            </button>
        </form>
    </section>
</template>

<script setup>
    import axios from 'axios';
    import { reactive } from 'vue';
    import { showNotification } from '@/shared/notification_message';

    const passwords = reactive({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    /**
     * Updates the user's password.
     */
    const updatePassword = async () => {
        if (passwords.newPassword !== passwords.confirmPassword) {
            showNotification("Passwords do not match!", "warning");
            return;
        }

        try {
            await axios.post('/api/update_password/', {
                current_password: passwords.currentPassword,
                new_password: passwords.newPassword
            });

            showNotification("Password updated successfully!", "success");
            resetPasswordFields();
        } catch (error) {
            showNotification(error.response.data.error, "error");
        }
    };

    /**
     * Resets the password input fields.
     */
    const resetPasswordFields = () => {
        passwords.currentPassword = "";
        passwords.newPassword = "";
        passwords.confirmPassword = "";
    };
</script>