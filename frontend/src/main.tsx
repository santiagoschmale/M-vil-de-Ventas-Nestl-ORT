import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

import theme from './theme';

import Router from './presentation/Router';
import { Home } from './presentation/pages/Home/Home';
import { iniciarSesion } from './infra/auth';


const root = ReactDOM.createRoot(document.getElementById('root')!)

async function deferRender() {
  if (import.meta.env.MODE === 'development') {
    const { worker } = await import('./mocks/worker')
    await worker.start()
  }
  // Con Entra configurado en el backend, la pantalla se muestra recién con la sesión iniciada.
  await iniciarSesion()
}

deferRender().then(() => {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Home />
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
})
