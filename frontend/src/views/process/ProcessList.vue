<template>
    <div>
        <SlideBar>
            <div class="flex-1 grid place-items-center">
                <div class="w-1/2 p-5 rounded-lg border-2 border-stroke bg-terciary grid">
                    <!-- Card header -->
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <img src="@/assets/icons/file-01.svg" class="h-6 w-6">
                            <div class="grid">
                                <h1 class="text-base text-primary font-medium">Laboral Ordinario</h1>
                                <h2 class="text-sm text-gray-500 font-regular">Acoso Laboral</h2>
                            </div>
                        </div>
                        <ChevronUpIcon class="h-6 w-6"></ChevronUpIcon>
                    </div>
                    <!-- Relevant information -->
                    <div class="font-medium mt-4 space-y-1">
                        <!-- Authority information -->
                        <div class="flex gap-2">
                            <h3 class="text-base text-primary">Autoridad:</h3>
                            <p class="text-gray-500">Juzgado 32 Laboral del Circuito de Bogotá DC.</p>
                        </div>
                        <!-- Accionant information -->
                        <div class="flex gap-2">
                            <h3 class="text-base text-primary">Dte./Accionante:</h3>
                            <p class="text-gray-500">Karen Estefania España Chavez</p>
                        </div>
                        <!-- plaintiff information -->
                        <div class="flex gap-2">
                            <h3 class="text-base text-primary">Dte./Accionado:</h3>
                            <p class="text-gray-500">SINTRACOLPEN</p>
                        </div>
                        <!-- Ref information -->
                        <div class="flex gap-2">
                            <h3 class="text-base text-primary">Radicado:</h3>
                            <p class="text-gray-500">11001310503220210062300</p>
                        </div>
                        <!-- Last stage -->
                        <div class="flex gap-2">
                            <h3 class="text-base text-primary">Etapa Procesal:</h3>
                            <p class="text-gray-500">Fallo</p>
                        </div>
                    </div>
                    <!-- Timeline of process state -->
                    <div class="relative mt-16">
                        <!-- Line -->
                        <div class="relative">
                            <div class="flex justify-between">
                                <div class="border-2 border-gray-500 h-4 w-0"></div>
                                <div class="border-2 border-gray-500 h-4 w-0"></div>
                            </div>
                            <div class="border-2 border-gray-500"></div>
                            <div class="flex justify-between">
                                <div class="border-2 border-gray-500 h-4 w-0"></div>
                                <div class="border-2 border-gray-500 h-4 w-0"></div>
                            </div>
                            <!-- Bubbles -->
                            <div
                                class="absolute top-1/2 left-0 right-0 z-10 transform -translate-y-1/2 flex w-full h-full px-16 justify-between items-center">
                                <div class="w-10 h-10 bg-secondary rounded-full"></div>
                                <div class="w-20 h-20 bg-secondary rounded-full"></div>
                                <div class="w-10 h-10 bg-white border-2 border-secondary rounded-full"></div>
                            </div>
                        </div>
                        <!-- Text of states -->
                        <div class="relative mt-5 px-16 flex justify-between items-center text-gray-500 font-medium">
                            <!-- Last but one state -->
                            <p class="text-xs w-10 text-center">Alegatos de conclusión</p>
                            <!-- Last state -->
                            <p class="text-sm w-20 text-center">Fallo</p>
                            <p class="w-10"></p>
                        </div>
                    </div>
                    <!-- Button for detail view -->
                    <div class="font-medium text-sm mt-8">
                        <button type="button" class="p-2.5 text-white bg-secondary rounded-md">
                            <span class="hidden lg:block">Consultar expediente</span>
                        </button>
                    </div>
                </div>
            </div>
        </SlideBar>
    </div>
</template>

<script setup>
import SlideBar from "@/components/layouts/SlideBar.vue";
import { ChevronUpIcon } from '@heroicons/vue/20/solid';
</script>