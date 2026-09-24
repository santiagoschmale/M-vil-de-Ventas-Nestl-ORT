import React, { useEffect, useState } from 'react';
import { GroupRounded, GridView } from '@mui/icons-material';
import { List, ListItem, ListItemIcon, ListItemText, ListItemButton, Divider } from '@mui/material';
import { Link, To } from 'react-router-dom';
import { IconMenu } from '../IconMenu';
import { Profile } from '../Profile';
import { Logo } from '../Logo';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useProfile } from '../../../../stores/useProfile';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';


interface SidebarItem {
  id: string;
  icon: React.ReactNode;
  text: string;
  to: To | string;
}


const LeftMenu = () => {

  const [items, setItems] = useState<SidebarItem[]>([])
  const { isAdmin, profile, fetchProfile } = useProfile();
    
  useEffect(() => {
    fetchProfile()
   }, []);
  
   useEffect(() => {

    const userItems: SidebarItem[] = []
    
    if(isAdmin()) {
      userItems.push({ id: 'users', icon: <GroupRounded />, text: 'Users', to: '/users' })
      userItems.push({ id: 'tokens', icon: <KeyRoundedIcon />, text: 'Tokens', to: '/tokens' })
    }
    
    setItems(userItems)
   
  }, [profile]);

  return (
    <>
      <div style={{ alignSelf: 'center', padding: '20px' }}>
        <Logo />
      </div>
      
      <div style={{ display: 'flex', flexGrow: 1, alignSelf: 'stretch' }}>
        <List  sx={{width: 1}}>
          {items.map((item, index) => (
            <ListItem data-testid="sidebar-link" key={`${item.id}-${String(index)}`} disablePadding>
              <ListItemButton to={item.to} component={Link}>
                <ListItemIcon style={{minWidth: '35px'}} >{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </div>
      
      <Divider />
      
      <div style={{display: 'flex' }}>  
        <div style={{ flexGrow:1, alignContent: 'center', padding: '15px' }}>
          <Profile />
        </div>
        
        <div style={{ alignContent: 'center', padding: '15px'  }}>
          <IconMenu
            id="profile-menu"
            links={[{ name: 'Logout', location: '/signout' }]}
            icon={<ExpandMoreRoundedIcon />}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            />
        </div>
      </div>
    </>
  )

};

export default LeftMenu;