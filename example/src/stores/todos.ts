import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Todo {
  id: number
  title: string
  done: boolean
}

export const useTodosStore = defineStore('todos', () => {
  const todos = ref<Todo[]>([])
  const remaining = computed(() => todos.value.filter(todo => !todo.done).length)

  function add(title: string) {
    const trimmed = title.trim()
    if (trimmed)
      todos.value.push({ id: Date.now() + todos.value.length, title: trimmed, done: false })
  }

  function toggle(id: number) {
    const todo = todos.value.find(item => item.id === id)
    if (todo)
      todo.done = !todo.done
  }

  return { todos, remaining, add, toggle }
})
