import React from 'react';
import { LogoLink, LogoImg } from './Logo.styles';

export const Logo = () => (
  <LogoLink to={{ pathname: '/' }} data-testid="logo_nestle" title="Início">
    <LogoImg alt="Nestlé" src="/images/logo/logo_nestle.svg" />
  </LogoLink>
);
