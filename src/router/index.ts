import { createWebHistory, createRouter } from 'vue-router'
import Main from '../components/Main.vue'

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
        component: () => import('../components/Soundboard.vue'),
      },
      {
        path: '/pulse-back',
        name: 'PulseBack',
        component: () => import('../components/PulseBackView.vue'),
      },
      {
        path: '/settings',
        name: 'Settings',
        component: () => import('../components/Settings.vue'),
      },
      {
        path: '/about',
        name: 'About',
        component: () => import('../components/About.vue'),
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
