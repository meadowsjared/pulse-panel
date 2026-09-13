<template>
  <div class="color-picker"
       ref="colorPickerRef">
    <label v-if="props.label"
           for="colorPicker"
           @click="togglePicker">{{ props.label }}</label>
    <div class="color-swatch"
         :style="{ backgroundColor: defaultColor }"
         @click="togglePicker"></div>

    <!-- Floating Teleported Dropdown picker -->
    <Teleport to="body">
      <div v-if="showPicker"
           ref="dropdownRef"
           class="color-picker-floating-dropdown"
           :style="dropdownStyle">
        <ColorPicker :pure-color="defaultColor"
                     @update:pure-color="updateColor"
                     format="hex8"
                     picker-type="chrome"
                     :is-widget="true"
                     use-type="pure"
                     theme="black"
                     lang="En"
                     :disable-history="true" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, defineAsyncComponent, nextTick } from 'vue';
import 'vue3-colorpicker/style.css';

const ColorPicker = defineAsyncComponent(() =>
  import('vue3-colorpicker').then(m => m.ColorPicker)
);

const props = withDefaults(defineProps<{
  modelValue: string | undefined;
  label?: string;
  align?: 'left' | 'right' | 'auto';
  placement?: 'bottom' | 'top' | 'auto';
}>(), {
  label: 'Color:',
  align: 'auto',
  placement: 'auto',
});

const emit = defineEmits<(event: 'update:modelValue', value: string | undefined) => void>();

const showPicker = ref(false);
const colorPickerRef = ref<HTMLElement>();
const dropdownRef = ref<HTMLElement>();
const dropdownStyle = ref<Record<string, string>>({});
let resizeObserver: ResizeObserver | null = null;

const defaultColor = computed({
  get: () => props.modelValue ?? '#ffffff',
  set: (value: string) => {
    emit('update:modelValue', value);
  },
});

const updateDropdownPosition = () => {
  if (!colorPickerRef.value) return;
  const swatchEl = (colorPickerRef.value.querySelector('.color-swatch') as HTMLElement) || colorPickerRef.value;
  const rect = swatchEl.getBoundingClientRect();

  // If the swatch is completely offscreen due to parent scroll, close the picker
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    showPicker.value = false;
    return;
  }

  const el = dropdownRef.value;
  const pickerWidth = el && el.offsetWidth > 0 ? el.offsetWidth : 276;
  const pickerHeight = el && el.offsetHeight > 0 ? el.offsetHeight : 270;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  // Decide whether to place above or below the swatch
  let placeAbove = false;
  if (props.placement === 'top') {
    placeAbove = spaceAbove >= pickerHeight + 6 || spaceAbove > spaceBelow;
  } else if (props.placement === 'bottom') {
    placeAbove = spaceBelow < pickerHeight + 6 && spaceAbove > spaceBelow;
  } else {
    // 'auto'
    placeAbove = spaceBelow < pickerHeight + 6 && spaceAbove > spaceBelow;
  }

  let top: number;
  if (placeAbove) {
    top = rect.top - pickerHeight - 6;
    // Keep within top viewport bound
    top = Math.max(8, top);
  } else {
    top = rect.bottom + 6;
    // Keep within bottom viewport bound
    top = Math.min(top, window.innerHeight - pickerHeight - 8);
    top = Math.max(8, top);
  }

  // Horizontal positioning
  let left = rect.left;
  if (props.align === 'right' || (props.align === 'auto' && window.innerWidth - rect.left < pickerWidth)) {
    left = rect.right - pickerWidth;
  }

  // Keep within horizontal viewport bounds
  left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));

  dropdownStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    zIndex: '99999',
  };
};

const attachObserver = () => {
  if (typeof ResizeObserver !== 'undefined' && dropdownRef.value) {
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateDropdownPosition();
      });
    }
    resizeObserver.observe(dropdownRef.value);
  }
};

const detachObserver = () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
};

const togglePicker = () => {
  showPicker.value = !showPicker.value;
  if (showPicker.value) {
    updateDropdownPosition();
    nextTick(() => {
      updateDropdownPosition();
      attachObserver();
    });
  } else {
    detachObserver();
  }
};

const updateColor = (color: string) => {
  defaultColor.value = color;
};

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  const insideTrigger = colorPickerRef.value && colorPickerRef.value.contains(target);
  const insideDropdown = dropdownRef.value && dropdownRef.value.contains(target);
  if (!insideTrigger && !insideDropdown) {
    showPicker.value = false;
    detachObserver();
  }
};

const handleScrollOrResize = () => {
  if (showPicker.value) {
    updateDropdownPosition();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleScrollOrResize);
  window.addEventListener('scroll', handleScrollOrResize, true);
});

onUnmounted(() => {
  detachObserver();
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleScrollOrResize);
  window.removeEventListener('scroll', handleScrollOrResize, true);
});
</script>

<style scoped>
.color-picker {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  position: relative;
}

.color-swatch {
  width: 64px;
  height: 32px;
  border: 2px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.color-swatch:hover {
  border-color: #999;
}
</style>

<style>
.color-picker-floating-dropdown {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  border-radius: 6px;
  overflow: hidden;
}
</style>
