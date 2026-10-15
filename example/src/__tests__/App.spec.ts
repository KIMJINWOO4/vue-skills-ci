import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

describe('App', () => {
  it('adds a todo and counts what is left', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })

    await wrapper.get('#new-todo').setValue('Write the release notes')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe('1 left')

    await wrapper.get('li input[type="checkbox"]').setValue(true)
    expect(wrapper.get('[role="status"]').text()).toBe('0 left')
  })

  it('ignores empty input', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })
})
