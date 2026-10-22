import type { Preview } from '@storybook/react-vite';
import '../src/app.css';

const preview: Preview = { parameters: { controls: { disableSaveFromUI: true } } };
export default preview;
