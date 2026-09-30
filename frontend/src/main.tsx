import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

import theme from './theme';

import Router from './presentation/Router';
import { Home } from './presentation/pages/Home/Home';


const root = ReactDOM.createRoot(document.getElementById('root')!)

async function deferRender() {
  if (import.meta.env.MODE !== 'development') {
    return
  }
  const { worker } = await import('./mocks/worker')
  return worker.start()
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
