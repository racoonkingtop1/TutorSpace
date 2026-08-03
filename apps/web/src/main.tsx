import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './state/AuthContext';
import './styles/tokens.css';

// HashRouter (not BrowserRouter): GitHub Pages has no server-side rewrite
// rule, so a deep link like /students/:id would 404 on refresh under a
// path-based router. Hash routing (/#/students/:id) always resolves to
// index.html regardless of host, at the cost of the # in the URL.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
