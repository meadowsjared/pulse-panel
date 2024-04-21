import { createWebHistory, createRouter } from 'vue-router'
import Home from '../components/Home.vue'
import About from '../components/About.vue'
import SystemInformation from '../components/SystemInformation.vue'
import Main from '../components/Main.vue'
import Settings from '../components/Settings.vue'
import Counter from '../components/Counter.vue'

const routes = [
  {
    path: '/',
    name: 'index',
    component: Main,
    redirect: '/home',
    children: [
      {
        path: '/home',
        name: 'Home',
        component: Home,
        children: [
          {
            path: 'counter',
            component: Counter,
          },
        ],
      },
      {
        path: '/system',
        name: 'System',
        component: SystemInformation,
      },
      {
        path: '/about',
        name: 'About',
        component: About,
      },
    ],
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/system',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
