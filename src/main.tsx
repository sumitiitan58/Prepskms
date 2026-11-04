import { createRoot } from 'react-dom/client';
import './firebase';
import './services/cloudStorage.js';
import './services/db.js';
import './services/razorpay.js';
import App from './App.tsx';
import './index.css';

let rootEl = document.getElementById('root');
if (!rootEl) {
  rootEl = document.createElement('div');
  rootEl.id = 'root';
  document.body.appendChild(rootEl);
}

createRoot(rootEl).render(<App />);
