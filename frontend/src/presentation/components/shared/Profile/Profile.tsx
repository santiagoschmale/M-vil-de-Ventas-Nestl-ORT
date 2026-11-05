import React from 'react';
import { Typography } from '@mui/material';
import { useProfile } from '../../../../stores';

export const Profile = () => {
  const { profile } = useProfile();
  
  const getFirstName = (unformated?: string) => {
    if(!unformated) {
      return 
    }
    // Nestlé manda "Apellido,Nombre"; Entra, "Nombre Apellido".
    if (!unformated.includes(',')) return unformated
    const names = unformated.split(',')
    return `${names[1]} ${names[0]}`
  };

  return (
    <>
      <Typography data-testid="profile_name" sx={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'capitalize' }}>
        {getFirstName(profile?.name)}
      </Typography>
      <Typography sx={{fontSize: '11px', textTransform: 'lowercase'}} gutterBottom data-testid="profile_username">
        {profile?.username}
      </Typography>
    </>
  );
};
