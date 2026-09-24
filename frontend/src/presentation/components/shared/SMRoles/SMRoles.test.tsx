import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SMRoles } from './SMRoles';

// Mock the dependencies
vi.mock('../Fallback', () => ({
  Fallback: vi.fn(({ children, condition, testId }) => (
    <div 
      data-testid={testId || 'mock-fallback'} 
      data-condition={condition.toString()}
    >
      {!condition && children}
    </div>
  ))
}));

vi.mock('../Multiselect', () => ({
  MultiSelect: vi.fn(({ name, label, required, values, options }) => (
    <div 
      data-testid="mock-multiselect"
      data-name={name}
      data-label={label}
      data-required={required ? 'true' : 'false'}
      data-values={values ? values.join(',') : ''}
    >
      <span data-testid="multi-select-options">
        {options && options.map((option, index) => (
          <span 
            key={index} 
            data-option-label={option.label} 
            data-option-value={option.value}
          />
        ))}
      </span>
      MultiSelect Component
    </div>
  ))
}));

describe('SMRoles Component', () => {
  it('renders with Fallback and correct testId', () => {
    render(<SMRoles waitExecuting={true} />);
    
    const fallback = screen.getByTestId('roles-fallback');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveAttribute('data-condition', 'true');
  });
  
  it('hides content when waitExecuting is true', () => {
    render(<SMRoles waitExecuting={true} />);
    
    // When condition is true, the content should not be visible
    expect(screen.queryByTestId('mock-multiselect')).not.toBeInTheDocument();
  });
  
  it('shows content when waitExecuting is false', () => {
    render(<SMRoles waitExecuting={false} />);
    
    // When condition is false, the content should be visible
    const multiselect = screen.getByTestId('mock-multiselect');
    expect(multiselect).toBeInTheDocument();
  });
  
  it('passes roles to MultiSelect correctly', () => {
    const testRoles = ['sm-admin', 'readonly'];
    render(<SMRoles waitExecuting={false} roles={testRoles} />);
    
    const multiselect = screen.getByTestId('mock-multiselect');
    expect(multiselect).toHaveAttribute('data-values', 'sm-admin,readonly');
  });
  
  it('handles undefined roles gracefully', () => {
    render(<SMRoles waitExecuting={false} />);
    
    const multiselect = screen.getByTestId('mock-multiselect');
    expect(multiselect).toHaveAttribute('data-values', '');
  });
  
  it('sets name, label, and required props on MultiSelect', () => {
    render(<SMRoles waitExecuting={false} />);
    
    const multiselect = screen.getByTestId('mock-multiselect');
    expect(multiselect).toHaveAttribute('data-name', 'roles');
    expect(multiselect).toHaveAttribute('data-label', 'Roles *');
    expect(multiselect).toHaveAttribute('data-required', 'true');
  });
  
  it('provides correct options for roles', () => {
    render(<SMRoles waitExecuting={false} />);
    
    const optionsContainer = screen.getByTestId('multi-select-options');
    
    // Check for admin option
    const adminOption = optionsContainer.querySelector('[data-option-value="sm-admin"]');
    expect(adminOption).toBeInTheDocument();
    expect(adminOption).toHaveAttribute('data-option-label', 'Admin');
    
    // Check for readonly option
    const readonlyOption = optionsContainer.querySelector('[data-option-value="readonly"]');
    expect(readonlyOption).toBeInTheDocument();
    expect(readonlyOption).toHaveAttribute('data-option-label', 'Read Only');
  });
});
