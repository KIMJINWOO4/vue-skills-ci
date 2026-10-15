export const items = ref<string[]>([])

export function useCart() {
  return { items }
}
