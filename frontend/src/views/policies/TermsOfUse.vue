<template>
  <div>
    <div class="relative p-4">
      <!-- Header with logo on right and back button on left -->
      <div class="flex justify-between items-center w-full">
        <!-- Logo on right -->
        <router-link :to="{ name: 'sign_in' }">
          <img class="w-20 xl:w-auto" src="@/assets/images/logo/logo1.png" />
        </router-link>

        <!-- Back Button with X icon on left -->
        <div>
          <router-link
            :to="{ name: 'sign_in' }"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <XMarkIcon class="w-6 h-6 text-gray-700" />
          </router-link>
        </div>
      </div>
    </div>

    <div class="max-w-3xl mx-auto mt-6 px-5">
      <!-- Main Title -->
      <h1 class="font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl mb-10">
        Términos y Condiciones
      </h1>

      <!-- Section: Introduction -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          1. Introducción
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          Este documento establece los términos y condiciones bajo los cuales se
          rige el acceso y uso de nuestra plataforma, propiedad de G&M
          Consultores Juridicos SAS, una empresa legalmente constituida en
          Colombia. Al utilizar nuestra plataforma, usted acepta cumplir con
          estos términos. Si no está de acuerdo, debe abstenerse de utilizarla.
        </p>
      </section>

      <!-- Section: Service Description -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          2. Descripción del Servicio
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          Nuestra plataforma ofrece un servicio que facilita la interacción
          entre abogados y sus clientes. Este servicio se presta de manera
          digital, permitiendo la administración y gestión de información
          relevante. Todas las funcionalidades ofrecidas están sujetas a estos
          términos.
        </p>
      </section>

      <!-- Section: Registration and Security -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          3. Registro y Seguridad
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          El usuario es responsable de mantener la confidencialidad de su cuenta
          y su contraseña. Al registrarse, debe proporcionar información veraz y
          actualizada. El uso de su cuenta está destinado exclusivamente para su
          propio uso, y cualquier actividad bajo su cuenta será su
          responsabilidad.
        </p>
      </section>

      <!-- Section: Conditions of Use -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          4. Condiciones de Uso
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          Los usuarios se comprometen a utilizar la plataforma de manera lícita
          y ética, sin incurrir en actividades que puedan dañar o afectar el
          correcto funcionamiento del servicio. Están prohibidos los actos que
          violen derechos de terceros, tales como la reproducción no autorizada
          de contenido, el uso fraudulento de información o el acceso no
          autorizado a cuentas de terceros.
        </p>
      </section>

      <!-- Section: Limitation of Liability -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          5. Limitación de Responsabilidad
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          La empresa no se responsabiliza por el mal uso que los usuarios hagan
          de la plataforma, ni por los daños o perjuicios derivados de la falta
          de diligencia en la administración de su cuenta. Además, no
          garantizamos la disponibilidad continua del servicio y nos reservamos
          el derecho de suspenderlo temporal o permanentemente sin previo aviso.
        </p>
      </section>

      <!-- Section: Modifications to Terms and Conditions -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          6. Modificaciones a los Términos y Condiciones
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          Nos reservamos el derecho de modificar estos Términos y Condiciones en
          cualquier momento. Los usuarios serán informados sobre las
          modificaciones importantes, las cuales entrarán en vigor
          inmediatamente después de su publicación en la plataforma. El uso
          continuado del servicio implica la aceptación de los nuevos términos.
        </p>
      </section>

      <!-- Section: Applicable Law and Jurisdiction -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          7. Ley Aplicable y Jurisdicción
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          Estos términos están regidos por las leyes de la República de
          Colombia. En caso de controversias derivadas de la interpretación o
          ejecución de estos términos, las partes se someterán a la jurisdicción
          de los tribunales competentes en Colombia.
        </p>
      </section>

      <!-- Section: Contact -->
      <section class="mb-8">
        <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
          8. Contacto
        </h2>
        <p class="block mb-2 text-sm font-medium text-gray-900">
          Para cualquier consulta relacionada con estos Términos y Condiciones,
          puede comunicarse con nosotros a través del correo electrónico:
          info@gymconsultoresjuridicos.com.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline';
</script>
