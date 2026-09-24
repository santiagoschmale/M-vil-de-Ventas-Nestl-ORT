import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConditionalRendering } from './ConditionalRendering';

describe('ConditionalRendering Test', () => {
  it('not should render child', () => {
    render(
      <ConditionalRendering condition={false}>
        <div data-testid="child_context">Children Context</div>
      </ConditionalRendering>,
    );

    expect(() => screen.getByTestId(`child_context`)).toThrow();
  });

  it('Should render div', () => {
    render(
      <ConditionalRendering condition>
        <div data-testid="child_context">Children Context</div>
      </ConditionalRendering>,
    );

    expect(screen.getByTestId(`child_context`)).toBeInTheDocument();
  });
});
