import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Base, { BaseProps } from './Base';

// Mock the FilterTextField component
vi.mock('../../shared/FilterTextField/FilterTextField', () => ({
  default: vi.fn(({ filter }) => <input type="text" placeholder="Mocked FilterTextField" onChange={() => filter('test')} />),
}));

describe('Base Component', () => {
  const defaultProps: BaseProps = {
    content: <div>Test Content</div>,
    actions: <button>Test Action</button>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders content and actions', () => {
    render(<Base {...defaultProps} />);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test Action' })).toBeInTheDocument();
  });

  it('applies default height of 100vh', () => {
    const { container } = render(<Base {...defaultProps} />);
    // The first child of the container is the main div with the style
    expect(container.firstChild).toHaveStyle('height: 100vh');
  });

  it('applies custom height when provided', () => {
    const customHeight = '500px';
    const { container } = render(<Base {...defaultProps} height={customHeight} />);
    expect(container.firstChild).toHaveStyle(`height: ${customHeight}`);
  });

  describe('Title and Filter', () => {
    it('renders title with h5 variant and a divider by default', () => {
      render(<Base {...defaultProps} title="My Title" />);
      const titleElement = screen.getByText('My Title');
      expect(titleElement).toBeInTheDocument();
      expect(titleElement.tagName).toBe('H5'); // MUI Typography renders h5
      expect(screen.getByRole('separator')).toBeInTheDocument(); // MUI Divider
    });

    it('does not render title or divider if title prop is not provided', () => {
      render(<Base {...defaultProps} />);
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('renders FilterTextField when title and filterFunction are provided', () => {
      const mockFilterFn = vi.fn();
      render(<Base {...defaultProps} title="My Title" filterFunction={mockFilterFn} />);
      expect(screen.getByPlaceholderText('Mocked FilterTextField')).toBeInTheDocument();
    });

    it('does not render FilterTextField if filterFunction is not provided', () => {
      render(<Base {...defaultProps} title="My Title" />);
      expect(screen.queryByPlaceholderText('Mocked FilterTextField')).not.toBeInTheDocument();
    });

    it('does not render FilterTextField if title is not provided, even if filterFunction is', () => {
      const mockFilterFn = vi.fn();
      render(<Base {...defaultProps} filterFunction={mockFilterFn} />);
      expect(screen.queryByPlaceholderText('Mocked FilterTextField')).not.toBeInTheDocument();
    });
  });

  describe('Modal Mode', () => {
    it('renders title with h6 variant in modal mode', () => {
      render(<Base {...defaultProps} title="Modal Title" modal />);
      const titleElement = screen.getByText('Modal Title');
      expect(titleElement).toBeInTheDocument();
      expect(titleElement.tagName).toBe('H6'); // MUI Typography renders h6 in modal mode
    });

    it('does not render a divider in modal mode even if title is present', () => {
      render(<Base {...defaultProps} title="Modal Title" modal />);
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('applies specific padding for title section in modal mode', () => {
      // This test checks the style of the div containing the title and filter.
      // It's a bit implementation-dependent.
      render(<Base {...defaultProps} title="Modal Title" modal />);
      const titleSection = screen.getByText('Modal Title').parentElement?.parentElement; // Navigating to the styled div
      expect(titleSection).toHaveStyle('padding: 0px');
    });
  });

  it('renders actions in the designated actions area', () => {
    const MyActions = () => <button>Submit</button>;
    render(<Base content={<div>Content</div>} actions={<MyActions />} />);
    const actionsContainer = screen.getByRole('button', { name: 'Submit' }).parentElement;
    expect(actionsContainer).toHaveStyle('justify-content: flex-end');
  });
});
