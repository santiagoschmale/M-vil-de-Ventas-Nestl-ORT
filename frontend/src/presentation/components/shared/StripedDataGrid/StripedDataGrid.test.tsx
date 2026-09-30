import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the styled components directly instead of mocking the styled function
vi.mock('./StripedDataGrid.style', () => ({
  StripedDataGrid: vi.fn(({ 
    rows, 
    columns, 
    loading, 
    getRowClassName, 
    rowCount,
    rowHeight,
    paginationMode,
    paginationModel,
    onPaginationModelChange,
    pageSizeOptions,
    ...props 
  }) => (
    <div 
      data-testid="mock-styled-data-grid" 
      data-rows={rows?.length}
      data-columns={columns?.length}
      data-row-count={rowCount}
      data-row-height={rowHeight}
      data-loading={loading}
    >
      <div data-testid="grid-props">
        <span data-prop="paginationMode">{paginationMode}</span>
        <span data-prop="loading">{loading ? 'true' : 'false'}</span>
        {paginationModel && (
          <span data-prop="paginationModel">{`${paginationModel.page}-${paginationModel.pageSize}`}</span>
        )}
      </div>
      <div data-testid="grid-rows">
        {rows?.map((row, index) => (
          <div 
            key={index} 
            data-testid={`grid-row-${index}`}
            data-row-id={row.id}
            className={getRowClassName?.({ indexRelativeToCurrentPage: index })}
          >
            Row {index}
          </div>
        ))}
      </div>
      <div data-testid="grid-columns">
        {columns?.map((col, index) => (
          <div key={index} data-testid={`grid-column-${index}`}>{col.field}</div>
        ))}
      </div>
    </div>
  )),
  DataGridImg: vi.fn(({ src, alt, ...props }) => (
    <img data-testid="mock-data-grid-img" src={src} alt={alt} {...props} />
  ))
}));

// Import the component under test
import StripedGrid from './StripedDataGrid';
// Import this at the top level, not inside the describe block
import { DataGridImg } from './StripedDataGrid.style';

describe('StripedDataGrid Component', () => {
  const mockColumns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 130 }
  ];
  
  const mockRows = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' }
  ];

  it('renders with required props', () => {
    render(<StripedGrid columns={mockColumns} rows={mockRows} />);
    
    expect(screen.getByTestId('mock-styled-data-grid')).toBeInTheDocument();
    expect(screen.getByTestId('mock-styled-data-grid')).toHaveAttribute('data-rows', '3');
    expect(screen.getByTestId('mock-styled-data-grid')).toHaveAttribute('data-columns', '2');
  });

  it('renders with loading state', () => {
    render(<StripedGrid columns={mockColumns} rows={mockRows} loading={true} />);
    
    expect(screen.getByTestId('grid-props').querySelector('[data-prop="loading"]')).toHaveTextContent('true');
    expect(screen.getByTestId('mock-styled-data-grid')).toHaveAttribute('data-loading', 'true');
  });

  it('passes pagination props correctly', () => {
    const paginationModel = { page: 1, pageSize: 10 };
    const handlePaginationModelChange = vi.fn();
    
    render(
      <StripedGrid 
        columns={mockColumns} 
        rows={mockRows} 
        paginationMode="server" 
        paginationModel={paginationModel}
        setPaginationModel={handlePaginationModelChange}
      />
    );
    
    expect(screen.getByTestId('grid-props').querySelector('[data-prop="paginationMode"]')).toHaveTextContent('server');
    expect(screen.getByTestId('grid-props').querySelector('[data-prop="paginationModel"]')).toHaveTextContent('1-10');
  });

  it('applies correct row classNames for even/odd rows', () => {
    render(<StripedGrid columns={mockColumns} rows={mockRows} />);
    
    // Check even rows get 'even' class
    expect(screen.getByTestId('grid-row-0')).toHaveClass('even');
    expect(screen.getByTestId('grid-row-2')).toHaveClass('even');
    
    // Check odd rows get 'odd' class
    expect(screen.getByTestId('grid-row-1')).toHaveClass('odd');
  });

  it('sets correct rowCount when provided', () => {
    const rowCount = 100;
    render(<StripedGrid columns={mockColumns} rows={mockRows} rowCount={rowCount} />);
    
    expect(screen.getByTestId('mock-styled-data-grid')).toHaveAttribute('data-row-count', '100');
  });

  it('passes rowHeight prop correctly', () => {
    const rowHeight = 50;
    render(<StripedGrid columns={mockColumns} rows={mockRows} rowHeight={rowHeight} />);
    
    expect(screen.getByTestId('mock-styled-data-grid')).toHaveAttribute('data-row-height', '50');
  });
});

// Create a separate file for testing the styled components directly if needed
describe('DataGridImg Component', () => {
  it('renders properly with props', () => {
    render(<DataGridImg src="test.jpg" alt="Test Image" />);
    
    const img = screen.getByTestId('mock-data-grid-img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'test.jpg');
    expect(img).toHaveAttribute('alt', 'Test Image');
  });
});
