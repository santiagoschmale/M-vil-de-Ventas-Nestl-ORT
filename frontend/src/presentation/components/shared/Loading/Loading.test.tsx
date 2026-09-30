import React from 'react';
import { render, screen } from '@testing-library/react';
import Loading from './Loading';

describe('Loading tests', () => {
  it('should render', () => {
    render(<Loading />);

    expect(screen.getByTestId('circular-progress')).toBeInTheDocument();
  });
});
