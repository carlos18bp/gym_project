<template>
    <div class="bg-selected-background w-screen h-screen flex justify-center items-center">
        <div class="flex flex-col items-center justify-center space-y-2 text-center">
            <GlobeAmericasIcon class="w-40 h-40 text-primary"></GlobeAmericasIcon>
            <h1 class="text-4xl text-primary font-semibold">¡Parece que no hay internet!</h1>
            <p class="text-xl text-gray-500 font-regular">Revisa tu conexión para seguir navegando.</p>
        </div>
    </div>
</template>

<script setup>
import {GlobeAmericasIcon} from '@heroicons/vue/24/outline';
</script>