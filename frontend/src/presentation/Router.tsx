import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { UsersPage } from './pages/Users';
import { TokensPage } from './pages/Tokens';


const Router: React.FC = () => (
  <Routes>
    <Route path="/users" element={<UsersPage />} />
    <Route path="/tokens" element={<TokensPage />} />
  </Routes>
);

export default Router;
