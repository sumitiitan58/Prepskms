import { createRoot } from 'react-dom/client';
import './firebase';
import App from './App.tsx';
import './index.css';

let rootEl = document.getElementById('root');
if (!rootEl) {
  rootEl = document.createElement('div');
  rootEl.id = 'root';
  document.body.appendChild(rootEl);
}

createRoot(rootEl).render(<App />);
