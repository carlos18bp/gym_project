<template>
    <div class="h-screen flex">
        <div class="h-full w-3/5 bg-primary p-8 flex flex-col justify-center">
            <div>
                <h2 class="text-secondary text-xl font-bold">Project<br>App.</h2>
            </div>
            <div class="flex-grow flex items-center">
                <h1 class="text-secondary text-4xl"><span class="font-bold">This is a Github repository about</span><br><span class="font-regular text-2xl">Sign in & Sign on feature integrated with Google and Email Verification</span></h1>
            </div>
        </div>
        <div class="h-full w-2/5 bg-black flex items-center justify-center">
            <div>
                <RouterLink :to="{ name: 'sign_in' }" class="text-black text-4xl font-medium text-left">
                    <span class="bg-white px-4  text-left">Press</span>
                    <span class="bg-white px-4 pb-2 block text-left">Start to go</span>
                </RouterLink>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { RouterLink } from 'vue-router';
</script>

