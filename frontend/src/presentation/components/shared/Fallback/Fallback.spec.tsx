import React from 'react';
import { render, screen } from '@testing-library/react';
import { Fallback } from './Fallback';

describe('Fallback Test', () => {
  it('Should render fallback', () => {
    render(
      <Fallback testId="fallback" condition>
        <div data-testid="child_context">Children Context</div>
      </Fallback>,
    );

    expect(screen.getByTestId(`fallback`)).toBeInTheDocument();
    expect(() => screen.getByTestId(`child_context`)).toThrow();
  });

  it('Should render div', () => {
    render(
      <Fallback condition={false}>
        <div data-testid="child_context">Children Context</div>
      </Fallback>,
    );

    expect(screen.getByTestId(`child_context`)).toBeInTheDocument();
  });
});
