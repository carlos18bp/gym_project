import { mount } from '@vue/test-utils';
import HelloWorld from '@/components/HelloWorld.vue';

test('renders a message', () => {
  const wrapper = mount(HelloWorld, {
    props: {
      msg: 'Hello Vue 3'
    }
  });
  expect(wrapper.text()).toContain('Hello Vue 3');
});