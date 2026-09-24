import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActionButton, { SubmitButtonProps, LabelButtonProps, OnClickButtonProps, HrefButtonProps } from './ActionButton';

describe('ActionButton', () => {
  it('renders with children and default props', () => {
    render(<ActionButton>Click Me</ActionButton>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('MuiButton-contained'); // Default variant
    expect(button).toHaveClass('MuiButton-containedPrimary'); // Default color
    expect(button).toHaveClass('MuiButton-sizeLarge'); // Default size
  });

  it('is disabled when disabled prop is true', () => {
    render(<ActionButton disabled>Click Me</ActionButton>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeDisabled();
  });

  it('shows loading spinner when loading is true and renders children', () => {
    render(<ActionButton loading>Click Me</ActionButton>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Click Me'); // Check children are still rendered
  });

  it('shows loading spinner with progress when loading and progress are true and renders children', () => {
    render(<ActionButton loading progress={50}>Click Me</ActionButton>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Click Me'); // Check children are still rendered
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    const props: OnClickButtonProps = { onClick: handleClick, children: 'Click Me' };
    render(<ActionButton {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a link when href is provided', () => {
    const props: HrefButtonProps = { href: 'https://example.com', target: '_blank', children: 'Open Link' };
    render(<ActionButton {...props} />);
    const linkElement = screen.getByRole('link', { name: /open link/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', 'https://example.com');
    expect(linkElement).toHaveAttribute('target', '_blank');
  });

  it('renders with type submit', () => {
    const props: SubmitButtonProps = { type: 'submit', children: 'Submit Form' };
    render(<ActionButton {...props} />);
    expect(screen.getByRole('button', { name: /submit form/i })).toHaveAttribute('type', 'submit');
  });

  it('renders with component as label', () => {
    const props: LabelButtonProps = { component: 'label', children: 'Upload File' };
    render(<ActionButton {...props} />);
    // MUI renders a span inside the button when component="label" is used with Button component
    // The button itself doesn't become a label, but it's styled to act like one for file inputs.
    // We check if the button contains the text.
    expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument();
  });

  it('renders with secondary color', () => {
    render(<ActionButton color="secondary">Secondary Action</ActionButton>);
    const button = screen.getByRole('button', { name: /secondary action/i });
    expect(button).toHaveClass('MuiButton-containedSecondary');
    expect(button).not.toHaveClass('MuiButton-containedPrimary');
  });

  it('renders with success color', () => {
    render(<ActionButton color="success">Success Action</ActionButton>);
    const button = screen.getByRole('button', { name: /success action/i });
    expect(button).toHaveClass('MuiButton-containedSuccess');
    expect(button).not.toHaveClass('MuiButton-containedPrimary');
  });
});
