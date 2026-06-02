import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import './styles/tokens.css';
import './styles/primitives.css';
import './styles.css';
import './styles/gantt-skin.css';
import './styles/filterbar.css';
import './styles/detail-skin.css';
import './styles/mobile-skin.css';
import './styles/admin-skin.css';
import './styles/chrome-skin.css';
import './styles/modal-skin.css';
import './styles/rails-skin.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
