<template>
  <div class="toggle-group" :class="classNames" @click="toggle">
    <button class="toggle">
      <div :class="['toggle-switch', { toggled: modelValue, clicked }]"></div>
    </button>
    <div class="toggleText">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    classNames?: string
  }>(),
  {
    modelValue: false,
  }
)

const clicked = ref(false)

const emit = defineEmits<(event: 'update:modelValue', value: boolean) => void>()

const toggle = () => {
  clicked.value = true
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
  background-color: var(--input-bg-color);
  border-radius: 15px;
  position: relative;
  display: flex;
  transition: background-color 0.3s;
}

.toggle:has(.toggle-switch.toggled) {
  background-color: var(--active-color);
}

.toggle-switch {
  width: 20px;
  height: 20px;
  background-color: var(--text-color);
  border-radius: 25px;
  position: absolute;
  top: 15%;
  left: 0.25rem;
  --animation-length: 0.5s;
  --scale: 1.7;
  --stretch-width: 40px;
}

.toggle-switch.clicked {
  animation: bounce-left var(--animation-length) forwards;
}

.toggle-switch.toggled:not(.clicked) {
  transform: translate(1.3rem, 0);
}

.toggle-switch.clicked.toggled {
  animation: bounce-right var(--animation-length) forwards;
}

@keyframes bounce-right {
  0% {
    transform: translate(0, 0);
    width: 20px;
  }
  10% {
    transform: translate(0.4rem, 0);
    width: var(--stretch-width);
  }
  60% {
    transform: translate(0.1rem, 0);
  }
  80% {
    transform: translate(0.4rem, 0);
  }
  90% {
    transform: translate(0.3rem, 0);
    width: var(--stretch-width);
  }
  100% {
    transform: translate(1.3rem, 0);
    width: 20px;
  }
}

@keyframes bounce-left {
  0% {
    transform: translate(1.3rem, 0);
    width: 20px;
  }
  10% {
    transform: translate(1.3rem, 0);
  }
  60% {
    transform: translate(-0.3rem, 0);
    width: var(--stretch-width);
  }
  80% {
    transform: translate(0.2rem, 0);
  }
  90% {
    transform: translate(0.1rem, 0);
    width: var(--stretch-width);
  }
  100% {
    transform: translate(0, 0);
    width: 20px;
  }
}
</style>
