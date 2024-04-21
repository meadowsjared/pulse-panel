<template>
  <router-view />
</template>

<script setup lang="ts">
function openURL(url: string) {
  window.open(url);
}

// window.$nuxt.$router.push({ path: '/login' });

// export default {
//   name: "IndexPage",
//   components: {
//     SystemInformation,
//   },
//   data() {
//     return {
//       externalContent: "",
//     };
//   },
//   methods: {
//     openURL(url) {
//       window.open(url);
//     },
//   },
// };
</script>
