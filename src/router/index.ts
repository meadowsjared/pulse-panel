import { createWebHistory, createRouter } from 'vue-router'
import About from '../components/About.vue'
import Main from '../components/Main.vue'
import Settings from '../components/Settings.vue'
import Soundboard from '../components/Soundboard.vue'

const routes = [
  {
    path: '/',
    name: 'index',
    component: Main,
    redirect: '/soundboard', // Set /soundboard as the default page
    children: [
      {
        path: '/soundboard',
        name: 'Soundboard',
        component: Soundboard,
      },
      {
        path: '/settings',
        name: 'Settings',
        component: Settings,
      },
      {
        path: '/about',
        name: 'About',
        component: About,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/soundboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
