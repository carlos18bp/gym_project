<script setup>
import { computed } from 'vue';
import { GlobeAltIcon, ScaleIcon, ChatBubbleLeftRightIcon, UsersIcon, Cog6ToothIcon,
  FolderIcon, DocumentTextIcon, BuildingLibraryIcon, ClipboardDocumentListIcon,
  InboxArrowDownIcon, CalendarDaysIcon, BuildingOfficeIcon, HomeIcon, BellAlertIcon,
  NewspaperIcon, UserCircleIcon, CreditCardIcon, ShieldCheckIcon, BookOpenIcon,
  Squares2X2Icon } from '@heroicons/vue/24/outline';
const props = defineProps({ name: { type: String, default: 'feature' } });
const icons = { ecosystem: GlobeAltIcon, legal: ScaleIcon, attention: ChatBubbleLeftRightIcon,
  collaboration: UsersIcon, account: Cog6ToothIcon, processes: FolderIcon, documents: DocumentTextIcon,
  secop: BuildingLibraryIcon, services: ClipboardDocumentListIcon, inbox: InboxArrowDownIcon,
  requests: ChatBubbleLeftRightIcon, appointments: CalendarDaysIcon, organizations: BuildingOfficeIcon,
  dashboard: HomeIcon, directory: UsersIcon, notifications: BellAlertIcon, updates: NewspaperIcon,
  intranet: ScaleIcon, authentication: UserCircleIcon, subscriptions: CreditCardIcon,
  administration: ShieldCheckIcon, help: BookOpenIcon };
const icon = computed(() => icons[props.name] || Squares2X2Icon);
</script>

<template><component :is="icon" aria-hidden="true" /></template>
