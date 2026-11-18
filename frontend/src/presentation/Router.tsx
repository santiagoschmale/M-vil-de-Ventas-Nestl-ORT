import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { MovilPage } from './pages/Movil';


const Router: React.FC = () => (
  <Routes>
    <Route path="/" element={<MovilPage />} />
  </Routes>
);

export default Router;