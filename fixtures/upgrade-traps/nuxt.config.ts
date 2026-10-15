export default defineNuxtConfig({
  vue: {
    compilerOptions: {
      eventDelegation: true,
    },
  },
  runtimeConfig: {
    public: {
      stripeSecretKey: '',
    },
  },
})
