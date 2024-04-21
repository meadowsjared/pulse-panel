<template>
  <div class="flex justify-center items-center">
    count is: {{ counterStore.count }}
    <div class="flex gap-2 ml-2">
      <button
        type="button"
        @click="counterStore.add()"
        class="bg-arubaGreen rounded px-3 py-1 my-4 text-white active:bg-greenSeduction active:text-neutralLight-400">
        <inline-svg :src="addIcon" class="w-6 h-6" />
      </button>
      <button
        type="button"
        @click="counterStore.subtract()"
        class="bg-arubaGreen rounded px-3 py-1 my-4 text-white active:bg-greenSeduction active:text-neutralLight-400">
        <inline-svg :src="subtractIcon" class="w-6 h-6" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import InlineSvg from 'vue-inline-svg'
import addIcon from '../assets/images/streamlinehq-add-thick-interface-essential-50.svg'
import subtractIcon from '../assets/images/streamlinehq-subtract-thick-interface-essential-50.svg'
import { useCounterStore } from '../store/counter'

/**
 * @see {@code browser[:version][:platform]}
 */
const junk = 'things'

type Things = 'junk'

const things = 'junk'

console.log(things, junk)

/**
 * @class Foo
 */
class Foo {
  bar: string
  /**
   * @param {string} bar
   */
  constructor(bar: string) {
    this.bar = bar
  }
}

function foo(bar: Things): string {
  return '2'
}

/**
 * it does stuff
 * @see {@link Foo().bar this}
 * @param {Thing things}:string what do you think?
 * @example
 * ```
 * doStuff("things")
 * ```
 */
function doStuff(things: Things) {
  console.log('stuff')
}

function openURL(url: string) {
  window.open(url)
}

const counterStore = useCounterStore()
</script>

<style scoped>
/* Add your component styles here */
</style>
