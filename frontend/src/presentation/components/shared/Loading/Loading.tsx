import React from 'react';
import { CircularProgress } from '@mui/material';
import { Container } from './Loading.styles';

const Loading: React.FC = () => (
  <Container>
    <CircularProgress data-testid="circular-progress" />
  </Container>
);

export default Loading;
