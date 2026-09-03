import 'antd/dist/reset.css';
import './presentation/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './presentation/app/App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo EmuKey.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
