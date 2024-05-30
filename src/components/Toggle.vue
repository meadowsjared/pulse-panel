<template>
  <div class="toggle-group" :class="classNames" @click="toggle">
    <button class="toggle">
      <div :class="['toggle-switch', { toggled: modelValue }]"></div>
    </button>
    <div class="toggleText">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    classNames?: string
  }>(),
  {
    modelValue: false,
  }
)

const emit = defineEmits<(event: 'update:modelValue', value: boolean) => void>()

const toggle = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.toggle-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.toggle {
  width: 50px;
  height: 30px;
  background-color: var(--background-color);
  border-radius: 15px;
  position: relative;
  display: flex;
}

.toggle-switch {
  width: 20px;
  height: 20px;
  background-color: var(--text-color);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(25%, -50%);
  transition: transform 0.3s;
}

.toggle-switch.toggled {
  transform: translate(130%, -50%);
}
</style>
