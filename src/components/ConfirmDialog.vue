<template>
  <div v-if="showDialog" class="shaded-background">
    <div class="dialog">
      <h2>{{ title }}</h2>
      <p class="message">{{ message }}</p>
      <div class="button-group">
        <button class="light danger" @click="confirm">{{ confirmText }}</button>
        <button class="light" @click="cancel">{{ cancelText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  // define an emit that will update showDialog
  (event: 'update:showDialog', value: boolean): void
  (event: 'confirm'): void
}>()

// const showDialog = ref(false)
withDefaults(
  defineProps<{
    showDialog: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
  }>(),
  {
    title: 'Confirmation',
    message: 'Are you sure?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  }
)

const confirm = () => {
  emit('confirm')
  emit('update:showDialog', false)
}

const cancel = () => {
  emit('update:showDialog', false)
}
</script>

<style scoped>
.message {
  text-wrap: balance;
}

.dialog {
  opacity: 2;
  background-color: var(--background-color);
  border: 1px solid #ccc;
  padding: 20px;
  max-width: 20rem;
  margin: 0 auto;
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  top: 50%;
  transform: translate(-50%, -50%);
  left: 50%;
  z-index: 2;
}

.shaded-background {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  position: fixed;
  inset: 0;
  z-index: 1;
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.button-group > button {
  min-width: calc(7ch + 2rem);
}

p {
  width: 100%;
  max-width: none;
  min-width: none;
}
</style>
