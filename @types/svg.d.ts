import { ComponentOptions } from 'vue'

declare module '*.svg' {
  const component: ComponentOptions
  export default component
}
