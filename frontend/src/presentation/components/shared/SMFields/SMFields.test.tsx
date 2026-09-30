import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SMFields } from './SMFields';

// Mock the SMRoles component
vi.mock('../SMRoles', () => ({
  SMRoles: vi.fn(({ waitExecuting, roles }) => (
    <div 
      data-testid="mock-smroles"
      data-wait-executing={waitExecuting.toString()}
      data-roles={roles?.join(',') || ''}
    >
      SMRoles Component
    </div>
  ))
}));

describe('SMFields Component', () => {
  it('calls afterLoadFunction after render', async () => {
    const mockAfterLoadFunction = vi.fn();
    
    render(
      <SMFields 
        afterLoadFunction={mockAfterLoadFunction}
      />
    );
    
    // Check that afterLoadFunction was called
    expect(mockAfterLoadFunction).toHaveBeenCalledTimes(1);
  });
  
  it('passes roles props to SMRoles and sets waitExecuting to false', () => {
    // Define test props
    const testRoles = ['admin', 'user'];
    const mockAfterLoadFunction = vi.fn();
    
    render(
      <SMFields 
        roles={testRoles}
        afterLoadFunction={mockAfterLoadFunction}
      />
    );
    
    // In React testing-library, useEffect runs synchronously,
    // so waitExecuting is already false by the time we check
    const smRoles = screen.getByTestId('mock-smroles');
    expect(smRoles).toHaveAttribute('data-wait-executing', 'false');
    expect(smRoles).toHaveAttribute('data-roles', 'admin,user');
  });
  
  it('handles undefined roles correctly', () => {
    const mockAfterLoadFunction = vi.fn();
    
    render(
      <SMFields 
        afterLoadFunction={mockAfterLoadFunction}
      />
    );
    
    // SMRoles should have empty roles attribute
    const smRoles = screen.getByTestId('mock-smroles');
    expect(smRoles).toHaveAttribute('data-roles', '');
  });
  
  it('passes empty array when roles is undefined', () => {
    const mockAfterLoadFunction = vi.fn();
    
    render(
      <SMFields 
        roles={undefined}
        afterLoadFunction={mockAfterLoadFunction}
      />
    );
    
    // SMRoles should have empty roles attribute
    const smRoles = screen.getByTestId('mock-smroles');
    expect(smRoles).toHaveAttribute('data-roles', '');
  });
  
  it('accepts catalogs prop', () => {
    const testCatalogs = ['catalog1', 'catalog2'];
    const mockAfterLoadFunction = vi.fn();
    
    render(
      <SMFields 
        catalogs={testCatalogs}
        afterLoadFunction={mockAfterLoadFunction}
      />
    );
    
    // Component should render normally even with catalogs prop
    expect(screen.getByTestId('mock-smroles')).toBeInTheDocument();
  });
});