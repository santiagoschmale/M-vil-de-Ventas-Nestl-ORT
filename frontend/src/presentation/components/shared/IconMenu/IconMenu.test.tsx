import React from 'react';
import * as navigate from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuIcon from '@mui/icons-material/Menu';
import { IconMenu } from './IconMenu';

vi.mock('react-router-dom');

describe('IconMenu Test', () => { 
  beforeEach(() => {
    render(
      <IconMenu
        id="system-menu"
        itens={[{ name: 'test', location: '/users' }]}
        icon={<MenuIcon />}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      />,
    );
  });

  it('Should render IconMenu', () => {
    expect(screen.getByText('test')).toBeDefined();
  });

  it('Should navigate to correct location', async () => {

    const nav = vi.fn()
    vi.spyOn(navigate, 'useNavigate').mockImplementation(() => nav)

    const iconButton = screen.getByTestId('icon-button');
    const menuItem = screen.getByTestId('menu-item');

    fireEvent.click(iconButton);
    fireEvent.click(menuItem);

    expect(nav).toHaveBeenCalledWith('/users');
  });
});
