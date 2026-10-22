// Full-screen Storybook entry for reviewing the calculator in its app shell.
import type { Meta, StoryObj } from '@storybook/react-vite';
import App from './App';

const meta = { title: 'Calculator/App', component: App, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default calculator view; Storybook's browser supplies the surrounding viewport. */
export const Default: Story = {};
