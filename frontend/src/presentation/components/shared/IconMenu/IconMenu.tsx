import React from 'react';
import { IconButton, Link, Menu, MenuItem, PopoverOrigin, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export type MenuOptions = {
  id: string;
  itens?: {
    name: string;
    location: string;
  }[];
  links?: {
    name: string;
    location: string;
  }[];
  anchorOrigin: PopoverOrigin;
  transformOrigin: PopoverOrigin;
  icon: JSX.Element;
};

export const IconMenu = (options: MenuOptions) => {
  const navigate = useNavigate();
  const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(null);
  const openMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);
  const closeMenu = () => setAnchorElNav(null);

  return (
    <>
      <IconButton
        data-testid="icon-button"
        size="small"
        onClick={openMenu}
        edge="start"
        color="inherit"
        aria-label="menu"
      >
        {options.icon}
      </IconButton>

      <Menu
        id={options.id}
        sx={{ width: 320, maxWidth: '100%' }}
        PaperProps= {{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            width: '180px',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 180,
              height: 32,
              ml: -0.5,
              mr: 1,
            }
          },
        }}
        test-dataid={options.id}
        anchorEl={anchorElNav}
        anchorOrigin={options.anchorOrigin}
        keepMounted
        transformOrigin={options.transformOrigin}
        open={Boolean(anchorElNav)}
        onClose={closeMenu}
      >
        {options.itens?.map(i => (
          <MenuItem
            data-testid="menu-item"
            key={i.name}
            onClick={() => {
              setAnchorElNav(null);
              navigate(i.location);
            }}
          >
            <Typography textAlign="center">{i.name}</Typography>
          </MenuItem>
        ))}
        {options.links?.map(i => (
          <MenuItem data-testid="menu-item" key={i.name} component={Link} href={i.location}>
            <Typography textAlign="center">{i.name}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
