<template>
  <div class="relative p-4">
    <router-link :to="{ name: 'sign_in' }">
      <img class="w-20 xl:w-auto" src="@/assets/images/logo/logo1.png" />
    </router-link>
  </div>

  <div class="max-w-3xl mx-auto mt-6 px-5">
    <!-- Main Title -->
    <h1 class="font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl mb-10">
      Política de Privacidad
    </h1>

    <!-- Section: Introduction -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        1. Introducción
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        En G&M Consultores Juridicos SAS, estamos comprometidos con la
        protección de su privacidad y el tratamiento adecuado de sus datos
        personales, de acuerdo con la Ley Estatutaria 1581 de 2012 y sus
        decretos reglamentarios en Colombia. Esta política explica cómo
        recopilamos, usamos y protegemos la información personal que usted nos
        proporciona a través de nuestra plataforma.
      </p>
    </section>

    <!-- Section: Information Collected -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        2. Información que Recopilamos
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        Podemos recopilar los siguientes datos personales a través de la
        plataforma, especialmente al utilizar servicios como la autenticación
        con Google:
      </p>
      <ul class="list-disc ml-5 text-sm font-medium text-gray-900">
        <li>Datos identificativos (nombre, apellidos, correo electrónico)</li>
        <li>Información de acceso a la plataforma</li>
        <li>
          Información técnica (dirección IP, tipo de dispositivo, navegador)
        </li>
      </ul>
    </section>

    <!-- Section: Purpose of Data Processing -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        3. Finalidades del Tratamiento de Datos
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        Utilizamos su información personal para las siguientes finalidades:
      </p>
      <ul class="list-disc ml-5 text-sm font-medium text-gray-900">
        <li>Gestionar su acceso a la plataforma.</li>
        <li>Facilitar la interacción entre abogados y clientes.</li>
        <li>Cumplir con las obligaciones legales y documentuales.</li>
        <li>
          Mejorar la calidad de nuestros servicios mediante el análisis de su
          uso.
        </li>
      </ul>
      <p class="block mt-4 text-sm font-medium text-gray-900">
        No utilizaremos su información personal para fines diferentes a los
        indicados sin su consentimiento.
      </p>
    </section>

    <!-- Section: User Rights -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        4. Derechos de los Titulares de los Datos
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        De acuerdo con la Ley 1581 de 2012, los titulares de los datos tienen
        derecho a:
      </p>
      <ul class="list-disc ml-5 text-sm font-medium text-gray-900">
        <li>Conocer, actualizar y rectificar su información personal.</li>
        <li>
          Solicitar la supresión de sus datos cuando lo consideren necesario.
        </li>
        <li>
          Solicitar prueba de la autorización otorgada para el tratamiento de
          datos.
        </li>
        <li>
          Presentar quejas ante la Superintendencia de Industria y Comercio
          (SIC) en caso de incumplimiento.
        </li>
      </ul>
      <p class="block mt-4 text-sm font-medium text-gray-900">
        Para ejercer estos derechos, puede contactarnos a través del correo:
        info@gymconsultoresjuridicos.com.
      </p>
    </section>

    <!-- Section: Information Security -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        5. Seguridad de la Información
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        Adoptamos medidas técnicas y organizativas adecuadas para garantizar la
        seguridad de sus datos personales y prevenir su alteración, pérdida o
        acceso no autorizado. Usamos tecnología de cifrado para proteger la
        transmisión de información confidencial.
      </p>
    </section>

    <!-- Section: Information Sharing -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        6. Compartición de Información
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        No compartimos su información personal con terceros, excepto en los
        siguientes casos:
      </p>
      <ul class="list-disc ml-5 text-sm font-medium text-gray-900">
        <li>Cuando sea requerido por la ley o autoridades competentes.</li>
        <li>
          Con proveedores de servicios que actúan en nuestro nombre y bajo
          nuestras instrucciones.
        </li>
        <li>Con su consentimiento explícito.</li>
      </ul>
    </section>

    <!-- Section: Data Retention -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        7. Conservación de los Datos
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        Los datos personales se conservarán durante el tiempo necesario para
        cumplir con las finalidades descritas, o hasta que usted solicite su
        supresión, siempre que no exista una obligación legal que nos impida
        eliminar dicha información.
      </p>
    </section>

    <!-- Section: International Data Transfers -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        8. Transferencia Internacional de Datos
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        En algunos casos, puede ser necesario transferir sus datos a servidores
        ubicados fuera de Colombia. En tales casos, nos aseguraremos de que se
        cumplan las normativas aplicables sobre transferencia internacional de
        datos.
      </p>
    </section>

    <!-- Section: Modifications to Privacy Policy -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        9. Modificaciones a la Política de Privacidad
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        Nos reservamos el derecho de modificar esta política en cualquier
        momento. Las modificaciones se harán efectivas una vez publicadas en la
        plataforma. Le notificaremos cualquier cambio significativo y usted
        tendrá el derecho de decidir si acepta las nuevas condiciones.
      </p>
    </section>

    <!-- Section: Contact -->
    <section class="mb-8">
      <h2 class="font-bold text-xl xl:text-2xl 2xl:text-3xl mb-4">
        10. Contacto
      </h2>
      <p class="block mb-2 text-sm font-medium text-gray-900">
        Si tiene preguntas o inquietudes sobre nuestra Política de Privacidad o
        el tratamiento de sus datos, puede comunicarse con nosotros a través del
        correo: info@gymconsultoresjuridicos.com.
      </p>
    </section>
  </div>
</template>

<script setup>
</script>
