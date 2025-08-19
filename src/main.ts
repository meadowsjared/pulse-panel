import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Index from './Index.vue'
import router from './router'
import './main.css'
import 'vue-color/style.css'
import { useSettingsStore } from './store/settings'

// (
//   import.meta as ImportMeta & { env: { ELECTRON_DISABLE_SECURITY_WARNINGS: string } }
// ).env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const app = createApp(Index)

app.use(createPinia()) //use pinia
app.use(router) //use router
app.mount('#app')

const settingsStore = useSettingsStore()
document.title = settingsStore.appName
