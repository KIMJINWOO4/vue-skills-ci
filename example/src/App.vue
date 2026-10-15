<script setup lang="ts">
import { onStartTyping } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ref, useTemplateRef } from 'vue'
import { useTodosStore } from './stores/todos'

const store = useTodosStore()
const { todos, remaining } = storeToRefs(store)
const { add, toggle } = store

const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

onStartTyping(() => input.value?.focus())

function submit() {
  add(draft.value)
  draft.value = ''
}
</script>

<template>
  <main>
    <h1>Todos</h1>
    <form @submit.prevent="submit">
      <label for="new-todo">New todo</label>
      <input
        id="new-todo"
        ref="input"
        v-model="draft"
        autocomplete="off"
      >
      <button type="submit">
        Add
      </button>
    </form>
    <ul>
      <li
        v-for="todo in todos"
        :key="todo.id"
      >
        <label>
          <input
            type="checkbox"
            :checked="todo.done"
            @change="toggle(todo.id)"
          >
          {{ todo.title }}
        </label>
      </li>
    </ul>
    <p role="status">
      {{ remaining }} left
    </p>
  </main>
</template>
