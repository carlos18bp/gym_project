<template>
  <!-- Prompt Documents (if any) -->
  <template v-if="props.promptDocuments && displayablePromptDocuments.length > 0">
    <div
      v-for="document in displayablePromptDocuments"
      :key="document.id"
      :data-document-id="document.id"
      :class="[
        'flex items-center gap-2 py-2 px-4 border rounded-lg cursor-pointer transition',
        (document.state === 'Published' || document.state === 'FullySigned')
          ? 'border-green-400 bg-green-300/30 hover:bg-green-300/50'
          : 'border-stroke bg-white hover:bg-gray-100',
        highlightedDocId && String(highlightedDocId) === String(document.id) ? 'animate-pulse-highlight' : ''
      ]"
      :style="highlightedDocId && String(highlightedDocId) === String(document.id) ? 'border: 1px solid #CCE0FF !important;' : ''"
    >
      <component
        :is="document.state === 'Published' || document.state === 'FullySigned' ? CheckCircleIcon : PencilIcon"
        :class="
          (document.state === 'Published' || document.state === 'FullySigned')
            ? 'size-8 text-green-500'
            : 'size-8 text-secondary'
        "
      />
      <div class="flex justify-between items-center w-full">
        <div class="grid gap-1">
          <div class="flex items-center">
            <span class="text-base font-medium">{{ document.title }}</span>
            
            <!-- Signature icon with tooltip -->
            <div 
              v-if="document.requires_signature" 
              class="relative group ml-2"
            >
              <!-- Check icon for fully signed/formalized documents -->
              <svg 
                v-if="document.fully_signed"
                class="h-4 w-4 text-green-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              
              <!-- Check icon for documents the current user has signed but others haven't -->
              <svg 
                v-else-if="getCurrentUserSignature(document)?.signed"
                class="h-4 w-4 text-blue-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              
              <!-- Pen icon for documents requiring the user's signature -->
              <svg 
                v-else-if="getCurrentUserSignature(document)"
                class="h-4 w-4 text-yellow-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <!-- Regular pen icon for documents requiring signatures from others -->
              <svg 
                v-else
                class="h-4 w-4 text-blue-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <!-- Tooltip -->
              <div class="absolute z-10 w-48 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-150 -top-8 left-0 pointer-events-none tooltip-with-arrow">
                {{ document.fully_signed ? 'Documento formalizado' : getSignatureStatus(document) }}
              </div>
            </div>
          </div>
          <span class="text-sm font-regular text-gray-400">
            {{
              document.state === 'Published' ? 'Publicado' :
              document.state === 'Draft' ? 'Borrador' :
              document.state === 'Progress' ? 'En progreso' :
              document.state === 'Completed' ? 'Completado' :
              document.state === 'PendingSignatures' ? 'Pendiente de firmas' :
              document.state === 'FullySigned' ? 'Completamente firmado' :
              'Desconocido'
            }}
          </span>
        </div>
  
        <Menu as="div" class="relative inline-block text-left">
          <MenuButton class="flex items-center text-gray-400">
            <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
          </MenuButton>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <MenuItems
              class="absolute z-20 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5"
              :class="[
                props.promptDocuments ? 'right-auto left-0 -translate-x-[calc(100%-24px)]' : 'right-0 left-auto'
              ]"
            >
              <MenuItem
                v-for="option in getDocumentOptions(document)"
                :key="option.label"
              >
                <button
                  class="w-full text-left px-4 py-2 text-sm font-regular transition flex items-center gap-2"
                  :disabled="option.disabled"
                  @click="
                    !option.disabled && handleOption(option.action, document)
                  "
                  :class="{
                    'opacity-50 cursor-not-allowed': option.disabled,
                    'cursor-pointer': !option.disabled,
                  }"
                >
                  <NoSymbolIcon
                    v-if="option.disabled"
                    class="size-5 text-gray-400"
                    aria-hidden="true"
                  />
                  {{ option.label }}
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </div>
    </div>
  </template>

  <!-- Regular Document Lists (if no promptDocuments) -->
  <template v-else-if="!props.promptDocuments">
    <!-- Sección Documentos Jurídicos (sin firmas) -->
    <div class="mb-10 block w-full">
      <h2 v-if="lawyerManagedNonFullySignedDocuments.filter(doc => !doc.requires_signature).length > 0" class="text-lg font-medium text-gray-800 mt-8 mb-4 pb-2 border-b border-gray-300">Documentos Jurídicos</h2>
      <div
        v-for="document in lawyerManagedNonFullySignedDocuments.filter(doc => !doc.requires_signature)"
      :key="document.id"
      :data-document-id="document.id"
      :class="[
        'flex items-center gap-2 py-2 px-4 border rounded-lg cursor-pointer transition',
          (document.state === 'Published' || document.state === 'FullySigned') 
          ? 'border-green-400 bg-green-300/30 hover:bg-green-300/50'
          : 'border-stroke bg-white hover:bg-gray-100',
        highlightedDocId && String(highlightedDocId) === String(document.id) ? 'animate-pulse-highlight' : ''
      ]"
      :style="highlightedDocId && String(highlightedDocId) === String(document.id) ? 'border: 1px solid #CCE0FF !important;' : ''"
    >
      <component
          :is="document.state === 'Published' || document.state === 'FullySigned' ? CheckCircleIcon : PencilIcon"
        :class="
            (document.state === 'Published' || document.state === 'FullySigned')
            ? 'size-8 text-green-500'
            : 'size-8 text-secondary'
        "
      />
      <div class="flex justify-between items-center w-full">
        <div class="grid gap-1">
          <div class="flex items-center">
            <span class="text-base font-medium">{{ document.title }}</span>
            
            <!-- Signature icon with tooltip -->
            <div 
              v-if="document.requires_signature" 
              class="relative group ml-2"
            >
              <!-- Check icon for fully signed/formalized documents -->
              <svg 
                v-if="document.fully_signed"
                class="h-4 w-4 text-green-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              
              <!-- Check icon for documents the current user has signed but others haven't -->
              <svg 
                v-else-if="getCurrentUserSignature(document)?.signed"
                class="h-4 w-4 text-blue-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              
              <!-- Pen icon for documents requiring the user's signature -->
              <svg 
                v-else-if="getCurrentUserSignature(document)"
                class="h-4 w-4 text-yellow-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <!-- Regular pen icon for documents requiring signatures from others -->
              <svg 
                v-else
                class="h-4 w-4 text-blue-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <!-- Tooltip -->
              <div class="absolute z-10 w-48 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-150 -top-8 left-0 pointer-events-none tooltip-with-arrow">
                {{ document.fully_signed ? 'Documento formalizado' : getSignatureStatus(document) }}
              </div>
            </div>
          </div>
          <span class="text-sm font-regular text-gray-400">
              {{
                document.state === 'Published' ? 'Publicado' :
                document.state === 'Draft' ? 'Borrador' :
                document.state === 'Progress' ? 'En progreso' :
                document.state === 'Completed' ? 'Completado' :
                document.state === 'PendingSignatures' ? 'Pendiente de firmas' :
                document.state === 'FullySigned' ? 'Completamente firmado' :
                'Desconocido'
              }}
          </span>
        </div>
  
        <Menu as="div" class="relative inline-block text-left">
          <MenuButton class="flex items-center text-gray-400">
            <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
          </MenuButton>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <MenuItems
              class="absolute z-20 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5"
              :class="[
                props.promptDocuments ? 'right-auto left-0 -translate-x-[calc(100%-24px)]' : 'right-0 left-auto'
              ]"
            >
              <MenuItem
                v-for="option in getDocumentOptions(document)"
                :key="option.label"
              >
                <button
                  class="w-full text-left px-4 py-2 text-sm font-regular transition flex items-center gap-2"
                  :disabled="option.disabled"
                  @click="
                    !option.disabled && handleOption(option.action, document)
                  "
                  :class="{
                    'opacity-50 cursor-not-allowed': option.disabled,
                    'cursor-pointer': !option.disabled,
                  }"
                >
                  <NoSymbolIcon
                    v-if="option.disabled"
                    class="size-5 text-gray-400"
                    aria-hidden="true"
                  />
                  {{ option.label }}
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
        </div>
      </div>
    </div>

    <!-- Sección Documentos para Firmar (con firmas) -->
    <div class="mb-10 block w-full">
      <h2 v-if="lawyerManagedNonFullySignedDocuments.filter(doc => doc.requires_signature).length > 0" class="text-lg font-medium text-gray-800 mt-8 mb-4 pb-2 border-b border-gray-300">Documentos para Firmar</h2>
      <div
        v-for="document in lawyerManagedNonFullySignedDocuments.filter(doc => doc.requires_signature)"
        :key="document.id"
        :data-document-id="document.id"
        :class="[
          'flex items-center gap-2 py-2 px-4 border rounded-lg cursor-pointer transition',
          (document.state === 'Published' || document.state === 'FullySigned') 
            ? 'border-green-400 bg-green-300/30 hover:bg-green-300/50'
            : 'border-stroke bg-white hover:bg-gray-100',
          highlightedDocId && String(highlightedDocId) === String(document.id) ? 'animate-pulse-highlight' : ''
        ]"
        :style="highlightedDocId && String(highlightedDocId) === String(document.id) ? 'border: 1px solid #CCE0FF !important;' : ''"
      >
        <component
          :is="document.state === 'Published' || document.state === 'FullySigned' ? CheckCircleIcon : PencilIcon"
          :class="
            (document.state === 'Published' || document.state === 'FullySigned')
              ? 'size-8 text-green-500'
              : 'size-8 text-secondary'
          "
        />
        <div class="flex justify-between items-center w-full">
          <div class="grid gap-1">
            <div class="flex items-center">
              <span class="text-base font-medium">{{ document.title }}</span>
              
              <!-- Signature icon with tooltip -->
              <div 
                v-if="document.requires_signature" 
                class="relative group ml-2"
              >
                <!-- Check icon for fully signed/formalized documents -->
                <svg 
                  v-if="document.fully_signed"
                  class="h-4 w-4 text-green-500" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                
                <!-- Check icon for documents the current user has signed but others haven't -->
                <svg 
                  v-else-if="getCurrentUserSignature(document)?.signed"
                  class="h-4 w-4 text-blue-500" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                >
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
                
                <!-- Pen icon for documents requiring the user's signature -->
                <svg 
                  v-else-if="getCurrentUserSignature(document)"
                  class="h-4 w-4 text-yellow-500" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                >
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                </svg>
                
                <!-- Regular pen icon for documents requiring signatures from others -->
                <svg 
                  v-else
                  class="h-4 w-4 text-blue-500" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                >
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                </svg>
                
                <!-- Tooltip -->
                <div class="absolute z-10 w-48 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-150 -top-8 left-0 pointer-events-none tooltip-with-arrow">
                  {{ document.fully_signed ? 'Documento formalizado' : getSignatureStatus(document) }}
                </div>
              </div>
            </div>
            <span class="text-sm font-regular text-gray-400">
              {{
                document.state === 'Published' ? 'Publicado' :
                document.state === 'Draft' ? 'Borrador' :
                document.state === 'Progress' ? 'En progreso' :
                document.state === 'Completed' ? 'Completado' :
                document.state === 'PendingSignatures' ? 'Pendiente de firmas' :
                document.state === 'FullySigned' ? 'Completamente firmado' :
                'Desconocido'
              }}
            </span>
          </div>
    
          <Menu as="div" class="relative inline-block text-left">
            <MenuButton class="flex items-center text-gray-400">
              <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
            </MenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute z-20 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5"
                :class="[
                  props.promptDocuments ? 'right-auto left-0 -translate-x-[calc(100%-24px)]' : 'right-0 left-auto'
                ]"
              >
                <MenuItem
                  v-for="option in getDocumentOptions(document)"
                  :key="option.label"
                >
                  <button
                    class="w-full text-left px-4 py-2 text-sm font-regular transition flex items-center gap-2"
                    :disabled="option.disabled"
                    @click="
                      !option.disabled && handleOption(option.action, document)
                    "
                    :class="{
                      'opacity-50 cursor-not-allowed': option.disabled,
                      'cursor-pointer': !option.disabled,
                    }"
                  >
                    <NoSymbolIcon
                      v-if="option.disabled"
                      class="size-5 text-gray-400"
                      aria-hidden="true"
                    />
                    {{ option.label }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </div>

    <!-- Sección Documentos Firmados -->
    <div class="mb-10 block w-full">
      <h2 v-if="lawyerFullySignedDocuments.length > 0" class="text-lg font-medium text-gray-800 mt-8 mb-4 pb-2 border-b border-gray-300">Documentos Firmados</h2>
      <div
        v-for="document in lawyerFullySignedDocuments"
        :key="document.id"
        :data-document-id="document.id"
        :class="[
          'flex items-center gap-2 py-2 px-4 border rounded-lg cursor-pointer transition',
          (document.state === 'Published' || document.state === 'FullySigned') 
            ? 'border-green-400 bg-green-300/30 hover:bg-green-300/50'
            : 'border-stroke bg-white hover:bg-gray-100',
          highlightedDocId && String(highlightedDocId) === String(document.id) ? 'animate-pulse-highlight' : ''
        ]"
        :style="highlightedDocId && String(highlightedDocId) === String(document.id) ? 'border: 1px solid #CCE0FF !important;' : ''"
      >
        <component
          :is="document.state === 'Published' || document.state === 'FullySigned' ? CheckCircleIcon : PencilIcon"
          :class="
            (document.state === 'Published' || document.state === 'FullySigned')
              ? 'size-8 text-green-500'
              : 'size-8 text-secondary'
          "
        />
        <div class="flex justify-between items-center w-full">
          <div class="grid gap-1">
            <div class="flex items-center">
              <span class="text-base font-medium">{{ document.title }}</span>
              <div v-if="document.requires_signature" class="relative group ml-2">
                <svg v-if="document.fully_signed" class="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <svg v-else-if="getCurrentUserSignature(document)?.signed" class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                <svg v-else-if="getCurrentUserSignature(document)" class="h-4 w-4 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                <svg v-else class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                <div class="absolute z-10 w-48 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-150 -top-8 left-0 pointer-events-none tooltip-with-arrow">
                  {{ document.fully_signed ? 'Documento formalizado' : getSignatureStatus(document) }}
                </div>
              </div>
            </div>
            <span class="text-sm font-regular text-gray-400">
             {{ document.state === 'Published' ? 'Publicado' : document.state === 'Draft' ? 'Borrador' : document.state === 'Progress' ? 'En progreso' : document.state === 'Completed' ? 'Completado' : document.state === 'PendingSignatures' ? 'Pendiente de firmas' : document.state === 'FullySigned' ? 'Completamente firmado' : 'Desconocido' }}
            </span>
          </div>
          <Menu as="div" class="relative inline-block text-left">
            <MenuButton class="flex items-center text-gray-400"><EllipsisVerticalIcon class="size-6" aria-hidden="true" /></MenuButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems class="absolute z-20 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5" :class="[ props.promptDocuments ? 'right-auto left-0 -translate-x-[calc(100%-24px)]' : 'right-0 left-auto' ]">
                <MenuItem v-for="option in getDocumentOptions(document)" :key="option.label">
                  <button class="w-full text-left px-4 py-2 text-sm font-regular transition flex items-center gap-2" :disabled="option.disabled" @click="!option.disabled && handleOption(option.action, document)" :class="{ 'opacity-50 cursor-not-allowed': option.disabled, 'cursor-pointer': !option.disabled, }">
                    <NoSymbolIcon v-if="option.disabled" class="size-5 text-gray-400" aria-hidden="true" />{{ option.label }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </div>
  </template>

  <!-- "No documents" message -->
  <div v-if="showNoDocumentsMessage" class="text-center text-gray-500 py-8">
    No hay documentos disponibles para mostrar.
    </div>

  <!-- Edit Document Modal -->
  <ModalTransition v-show="showEditDocumentModal">
    <CreateDocumentByLawyer @close="closeEditModal" />
  </ModalTransition>

  <!-- Preview Modal -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
  
  <!-- Signatures Modal -->
  <DocumentSignaturesModal 
    :isVisible="showSignaturesModal"
    :documentId="selectedDocumentId"
    @close="closeSignaturesModal"
    @refresh="handleRefresh"
  />
  
  <!-- Versions Modal -->
  <DocumentVersionsModal 
    :isVisible="showVersionsModal"
    :documentId="selectedDocumentId"
    @close="closeVersionsModal"
  />

  <!-- Electronic Signature Modal -->
  <ModalTransition v-if="showElectronicSignatureModal">
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-auto">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-medium text-primary">Firma Electrónica</h2>
        <button 
          @click="showElectronicSignatureModal = false" 
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>
      <ElectronicSignature 
        :initialShowOptions="true"
        :user-id="userStore.currentUser.id"
        @signatureSaved="handleSignatureSaved" 
        @cancel="showElectronicSignatureModal = false"
      />
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import { get_request, create_request, delete_request } from "@/stores/services/request_http";

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import DocumentSignaturesModal from "@/components/dynamic_document/common/DocumentSignaturesModal.vue";
import DocumentVersionsModal from "@/components/dynamic_document/common/DocumentVersionsModal.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";

// Store instance
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Reactive state
const showEditDocumentModal = ref(false);
const showSignaturesModal = ref(false);
const showVersionsModal = ref(false);
const selectedDocumentId = ref(null);
const lastUpdatedDocId = ref(null);

// Reactive state for pending and signed documents
const pendingSignatureDocuments = ref([]);
const signedDocuments = ref([]);

// Reactive state for showing the electronic signature modal
const showElectronicSignatureModal = ref(false);

const props = defineProps({
  searchQuery: String,
  promptDocuments: {
    type: Array,
    default: null
  }
});

// --- Start of new computed properties for separate lists ---

// Documents managed by the lawyer (e.g., Draft, Published), EXCLUDING FullySigned
const lawyerManagedNonFullySignedDocuments = computed(() => {
  if (props.promptDocuments) return []; // Not used if promptDocuments are active

  const docs = documentStore.getDocumentsByLawyerId(userStore.currentUser.id) || [];
  return docs
    .filter(doc => doc.state !== 'FullySigned') // Exclude FullySigned
    .filter(doc => doc.title && doc.title.toLowerCase().includes(props.searchQuery.toLowerCase()));
});

// Fully Signed documents
const lawyerFullySignedDocuments = computed(() => {
  if (props.promptDocuments) return []; // Not used if promptDocuments are active

  const documentsFromStore = documentStore.getDocumentsByLawyerId(userStore.currentUser.id) || [];
  const signedByUserDocs = signedDocuments.value || []; // signedDocuments is already populated by fetchLawyerDocuments

  const combinedFullySigned = new Map();

  // Add FullySigned documents from the main store list
  documentsFromStore
    .filter(doc => doc.state === 'FullySigned')
    .forEach(doc => combinedFullySigned.set(doc.id, doc));
  
  // Add FullySigned documents from the user's signed list (could be overlapping, Map handles deduplication)
  signedByUserDocs
    .filter(doc => doc.state === 'FullySigned')
    .forEach(doc => combinedFullySigned.set(doc.id, doc));
    
  return Array.from(combinedFullySigned.values())
    .filter(doc => doc.title && doc.title.toLowerCase().includes(props.searchQuery.toLowerCase()));
});

// Filtered prompt documents (if provided)
const displayablePromptDocuments = computed(() => {
    if (props.promptDocuments && props.promptDocuments.length > 0) {
        return (props.promptDocuments || []).filter(doc => doc.title && doc.title.toLowerCase().includes(props.searchQuery.toLowerCase()));
    }
    return [];
});

// Condition for showing the "No documents available" message
const showNoDocumentsMessage = computed(() => {
  if (props.promptDocuments) {
    return displayablePromptDocuments.value.length === 0;
  }
  return lawyerManagedNonFullySignedDocuments.value.length === 0 && lawyerFullySignedDocuments.value.length === 0;
});

// --- End of new computed properties ---

// Retrieve documents in drafted and published from the store, applying the search filter.
// This 'filteredDocuments' is now for the main list (not fully signed) if not using promptDocuments.
// If promptDocuments is active, it takes precedence.
const filteredDocuments = computed(() => {
  if (props.promptDocuments) {
    return displayablePromptDocuments.value;
  }
  // This computed is somewhat redundant now if the template directly uses lawyerManagedNonFullySignedDocuments and lawyerFullySignedDocuments.
  // However, other parts of the script might still use `filteredDocuments` (e.g., highlightedDocId).
  // For safety, let's make it reflect the primary list of non-fully-signed documents.
  return lawyerManagedNonFullySignedDocuments.value;
});

// Computed property to determine which document should be highlighted
// This should ideally check across all displayed documents.
const highlightedDocId = computed(() => {
  // If we have prompt documents, don't show any highlight from store/localStorage
  if (props.promptDocuments) {
    return null;
  }

  const storeId = documentStore.lastUpdatedDocumentId;
  const localId = localStorage.getItem('lastUpdatedDocumentId');
  
  const allDisplayedDocs = [...lawyerManagedNonFullySignedDocuments.value, ...lawyerFullySignedDocuments.value];
  
  const docExistsInStoreId = storeId && allDisplayedDocs.some(doc => String(doc.id) === String(storeId));
  if (docExistsInStoreId) {
    return storeId;
  }
  
  const docExistsInLocalId = localId && allDisplayedDocs.some(doc => String(doc.id) === String(localId));
  if (docExistsInLocalId) {
    return localId;
  }
  
  return null;
});

/**
 * Fetch pending and signed documents for the current lawyer
 */
const fetchLawyerDocuments = async () => {
  try {
    const userId = userStore.currentUser.id;
    const pendingResponse = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    const signedResponse = await get_request(`dynamic-documents/user/${userId}/signed-documents/`);

    if (pendingResponse.status === 200) {
      pendingSignatureDocuments.value = pendingResponse.data;
    }

    if (signedResponse.status === 200) {
      signedDocuments.value = signedResponse.data;
    }
  } catch (error) {
    console.error('Error fetching lawyer documents:', error);
  }
};

/**
 * Get the available options for a document based on its state.
 * If the document has undefined variables, the "Publicar" option is disabled.
 * @param {object} document - The document to evaluate.
 * @returns {Array} - List of options.
 */
const getDocumentOptions = (document) => {
  const baseOptions = [
    { label: "Editar", action: "edit" },
    { label: "Eliminar", action: "delete" },
    { label: "Previsualización", action: "preview" },
  ];

  // Log for debugging
  console.log('Document ID:', document.id, 'Title:', document.title);
  console.log('Document state:', document.state);
  console.log('Document requires signature:', document.requires_signature);
  console.log('Document signatures:', document.signatures);
  
  // Get current user signature status FIRST - before any other logic
  let currentUserNeedsToSign = false;
  
  if (document.requires_signature && document.signatures && document.signatures.length > 0) {
    const currentUserId = String(userStore.currentUser.id);
    console.log('Current user ID:', currentUserId);
    
    // Find if current user needs to sign
    const userSignature = document.signatures.find(sig => 
      String(sig.signer_id) === currentUserId && !sig.signed
    );
    
    currentUserNeedsToSign = !!userSignature;
    console.log('User signature found:', userSignature);
    console.log('Current user needs to sign:', currentUserNeedsToSign);
  }

  // Add state-based options with validations
  if (document.state === "Draft") {
    baseOptions.push({
      label: "Publicar",
      action: "publish",
      disabled: !canPublishDocument(document),
    });
  } else if (document.state === "Published" || document.state === "FullySigned") {
    baseOptions.push({
      label: "Mover a Borrador",
      action: "draft",
      disabled: false,
    });
    
    // Add signature-related options for published or fully signed documents
    if (document.requires_signature || document.state === "FullySigned") {
      baseOptions.push({
        label: "Ver firmas",
        action: "view_signatures",
        disabled: false,
      });
      
      baseOptions.push({
        label: "Ver versiones",
        action: "view_versions",
        disabled: false,
      });
    }
  }
  
  // Add sign option if the lawyer needs to sign
  const needsToSign = pendingSignatureDocuments.value.some(doc => doc.id === document.id);
  if (needsToSign) {
    baseOptions.push({
      label: "Firmar documento",
      action: "sign_document",
      disabled: false,
    });
  }

  return baseOptions;
};

/**
 * Check if a document can be published by verifying all variable values are filled.
 * @param {object} document - The document to check.
 * @returns {boolean} - True if the document can be published, false otherwise.
 */
const canPublishDocument = (document) => {
  return document.variables.every(
    (variable) => variable.value && variable.value.trim().length > 0
  );
};

/**
 * Check if the current user is a signer for the document and get their signature record
 * @param {object} document - The document to check
 * @returns {object|null} - The signature record for the current user or null
 */
const getCurrentUserSignature = (document) => {
  // First, verify document has signatures and requires them
  if (!document.signatures || !document.requires_signature) {
    console.log(`Document ${document.id} has no signatures or doesn't require them`);
    return null;
  }
  
  // Get current user ID as string for comparison
  const currentUserId = String(userStore.currentUser.id);
  
  // Find signature for current user
  const signature = document.signatures.find(sig => String(sig.signer_id) === currentUserId);
  
  // Log for debugging
  if (signature) {
    console.log(`Found signature for user ${currentUserId} in document ${document.id}:`, signature);
  } else {
    console.log(`No signature found for user ${currentUserId} in document ${document.id}`);
  }
  
  return signature;
};

/**
 * Gets the signature status display text for a document
 * @param {Object} document - The document object
 * @returns {String} - Status text for display
 */
const getSignatureStatus = (document) => {
  if (!document.requires_signature) {
    return '';
  }
  
  if (document.fully_signed) {
    return 'Documento formalizado';
  }
  
  // Check if current user has already signed
  const currentUserSignature = getCurrentUserSignature(document);
  
  if (document.signatures && document.signatures.length > 0) {
    const totalSignatures = document.signatures.length;
    const signedCount = document.signatures.filter(sig => sig.signed).length;
    
    if (currentUserSignature && currentUserSignature.signed) {
      if (signedCount === 1 && totalSignatures > 1) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      } else if (signedCount < totalSignatures) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      }
    }
    
    return `Firmas: ${signedCount}/${totalSignatures}`;
  }
  
  return currentUserSignature ? 'Requiere tu firma' : 'Requiere firmas';
};

/**
 * Handle the selected option for a document.
 * @param {string} action - The action to perform.
 * @param {object} document - The target document.
 */
const handleOption = async (action, document) => {
  switch (action) {
    case "edit":
      documentStore.selectedDocument = document;
      showEditDocumentModal.value = true;
      break;
    case "delete":
      const confirmed = await showConfirmationAlert(
        `¿Deseas eliminar el documento '${document.title}'?`
      );
      if (confirmed) {
        await documentStore.deleteDocument(document.id);
        await showNotification("Documento eliminado correctamente.", "success");
      }
      break;
    case "publish":
      await publishDocument(document);
      // The notification is omitted because an automatic redirection will take place.
      break;
    case "draft":
      await moveToDraft(document);
      // The notification is omitted because an automatic redirection will take place.
      break;
    case "preview":
      openPreviewModal(document);
      break;
    case "view_signatures":
      viewDocumentSignatures(document);
      break;
    case "view_versions":
      viewDocumentVersions(document);
      break;
    case "sign_document":
      signDocument(document);
      break;
    default:
      console.warn(`Acción desconocida: ${action}`);
  }
};

/**
 * Publish the document by updating its state.
 * @param {object} document - The document to publish.
 */
const publishDocument = async (document) => {
  const updatedData = {
    ...document,
    state: "Published",
  };
  const response = await documentStore.updateDocument(document.id, updatedData);
  
  // Set this document as the last updated to highlight it
  documentStore.lastUpdatedDocumentId = document.id;
  localStorage.setItem('lastUpdatedDocumentId', document.id);
  
  // Try to force highlight first
  forceHighlight(document.id);
  
  // Check if we're already on the dashboard
  const currentPath = window.location.pathname;
  const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                      currentPath === '/dynamic_document_dashboard/';
  
  if (!isDashboard) {
    // Only redirect if not already on dashboard
    setTimeout(() => {
      window.location.href = '/dynamic_document_dashboard';
    }, 800);
  }
};

/**
 * Move the document to draft state.
 * @param {object} document - The document to update.
 */
const moveToDraft = async (document) => {
  const updatedData = {
    ...document,
    state: "Draft",
  };
  const response = await documentStore.updateDocument(document.id, updatedData);
  
  // Set this document as the last updated to highlight it
  documentStore.lastUpdatedDocumentId = document.id;
  localStorage.setItem('lastUpdatedDocumentId', document.id);
  
  // Try to force highlight first
  forceHighlight(document.id);
  
  // Check if we're already on the dashboard
  const currentPath = window.location.pathname;
  const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                      currentPath === '/dynamic_document_dashboard/';
  
  if (!isDashboard) {
    // Only redirect if not already on dashboard
    setTimeout(() => {
      window.location.href = '/dynamic_document_dashboard';
    }, 800);
  }
};

/**
 * Close the edit modal and clear the document reference.
 * Can receive an object with the ID of the updated document to highlight it.
 */
const closeEditModal = (eventData) => {
  showEditDocumentModal.value = false;
  documentStore.selectedDocument = null;
  
  // Check if we received data about which document was updated
  if (eventData && eventData.updatedDocId) {
    // Set the ID for visual highlight
    documentStore.lastUpdatedDocumentId = eventData.updatedDocId;
    localStorage.setItem('lastUpdatedDocumentId', eventData.updatedDocId);
    
    // Try to force highlight first
    forceHighlight(eventData.updatedDocId);
    
    // Check if we're already on the dashboard
    const currentPath = window.location.pathname;
    const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                        currentPath === '/dynamic_document_dashboard/';
    
    if (!isDashboard) {
      // Only redirect if not already on dashboard
      setTimeout(() => {
        window.location.href = '/dynamic_document_dashboard';
      }, 800);
    }
  }
};

// Make sure highlighted document ID is updated when filtered documents change
watch(filteredDocuments, (newDocs) => {
  // If we have prompt documents, don't update highlights
  if (props.promptDocuments) {
    return;
  }

  // If we have a lastUpdatedDocumentId, verify it exists in the list
  if (documentStore.lastUpdatedDocumentId) {
    const exists = newDocs.some(doc => String(doc.id) === String(documentStore.lastUpdatedDocumentId));
    
    // If not found but we have documents, use the newest one
    if (!exists && newDocs.length > 0) {
      // Sort by ID to get newest document
      const sortedDocs = [...newDocs].sort((a, b) => b.id - a.id);
      const newId = sortedDocs[0].id;
      
      documentStore.lastUpdatedDocumentId = newId;
      localStorage.setItem('lastUpdatedDocumentId', newId);
    }
  }
});

/**
 * Forces highlight on a specific document by directly manipulating DOM
 * @param {string|number} documentId - ID of the document to highlight
 */
const forceHighlight = (documentId) => {
  if (!documentId) return;
  
  // Find the actual DOM element
  setTimeout(() => {
    try {
      // Find element by attribute selector
      const documentElements = document.querySelectorAll(`[data-document-id="${documentId}"]`);
      
      if (documentElements.length > 0) {
        const element = documentElements[0];
        
        // Apply styles directly
        element.style.border = "2px solid #3b82f6";
        
        // Remove and re-add classes to restart animation
        element.classList.remove("animate-pulse-highlight");
        
        // Force a reflow before adding the class again
        void element.offsetWidth;
        
        // Add the classes again
        element.classList.add("animate-pulse-highlight");
        
        // Ensure visibility
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (error) {
      console.error("Error forcing highlight:", error);
    }
  }, 100);
};

// Expose the forceHighlight function globally for use by other components
window.forceDocumentHighlight = forceHighlight;

// Initialize data when component mounts
onMounted(async () => {
  // If we have prompt documents, don't initialize highlights
  if (props.promptDocuments) {
    return;
  }

  // Ensure documents are loaded
  await documentStore.init();
  
  const savedId = localStorage.getItem('lastUpdatedDocumentId');
  
  if (savedId) {
    documentStore.lastUpdatedDocumentId = savedId;
    
    // Force detection of changes in Vue
    setTimeout(() => {
      const docExists = filteredDocuments.value.some(doc => String(doc.id) === String(savedId));
      
      // If document exists, force a highlight
      if (docExists) {
        forceHighlight(savedId);
      }
    }, 500);
  }

  // Fetch pending and signed documents
  fetchLawyerDocuments();
});

// New functions to handle signature-related actions

/**
 * Navigate to signature view for a document.
 * @param {object} document - The document to view signatures for.
 */
const viewDocumentSignatures = (document) => {
  selectedDocumentId.value = document.id;
  showSignaturesModal.value = true;
};

/**
 * Navigate to versions view for a document.
 * @param {object} document - The document to view versions for.
 */
const viewDocumentVersions = (document) => {
  selectedDocumentId.value = document.id;
  showVersionsModal.value = true;
};

/**
 * Sign the document.
 * @param {object} document - The document to sign.
 */
const signDocument = async (document) => {
  try {
    console.log('Intentando firmar documento:', document.id);
    
    // First check if the user has a signature
    if (!userStore.currentUser.has_signature) {
      // Show warning and open the signature modal
      const createSignature = await showConfirmationAlert(
        "No tienes una firma registrada. ¿Deseas crear una firma ahora?",
        "Necesitas una firma",
        "Crear firma",
        "Cancelar"
      );
      
      if (createSignature) {
        // Open the electronic signature modal
        showElectronicSignatureModal.value = true;
      }
      return;
    }

    // Show confirmation dialog before signing
    const confirmed = await showConfirmationAlert(
      `¿Estás seguro de que deseas firmar el documento "${document.title}"?`,
      "Confirmar firma",
      "Firmar",
      "Cancelar"
    );

    if (!confirmed) {
      return;
    }

    console.log('Enviando solicitud para firmar documento', document.id);
    
    // Call the API to sign the document using create_request
    const response = await create_request(`dynamic-documents/${document.id}/sign/${userStore.currentUser.id}/`, {});
    console.log('Respuesta del servidor:', response);

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Error al firmar: ${response.statusText}`);
    }

    // Show success notification
    await showNotification("Documento firmado correctamente", "success");
    
    // Allow time for the backend to process the signature
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Refresh the document data
    await fetchLawyerDocuments(); // Asegurar que la lista de documentos se actualice
    
    // Highlight the document
    if (document.id) {
      documentStore.lastUpdatedDocumentId = document.id;
      localStorage.setItem('lastUpdatedDocumentId', document.id);
      forceHighlight(document.id);
    }
    
    // Refresh the page to ensure all data is up to date
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    console.error('Error al firmar el documento:', error);
    await showNotification(`Error al firmar el documento: ${error.message}`, "error");
  }
};

// New functions to handle modal closing
const closeSignaturesModal = () => {
  showSignaturesModal.value = false;
};

const closeVersionsModal = () => {
  showVersionsModal.value = false;
};

const handleRefresh = async () => {
  // Refresh the document list
  await documentStore.init();
};
</script>

<style scoped>
@keyframes pulse-highlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgba(59, 130, 246, 0.8);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(59, 130, 246, 0.4);
    border-color: rgba(59, 130, 246, 0.8);
    background-color: rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
  }
}

.animate-pulse-highlight {
  animation: pulse-highlight 1s ease-in-out 3;
  border-width: 2px !important;
  position: relative;
  z-index: 10;
}

/* Tooltip arrow styles */
.tooltip-with-arrow:after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 10px;
  margin-left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #1f2937; /* Match tooltip background color */
}
</style>
