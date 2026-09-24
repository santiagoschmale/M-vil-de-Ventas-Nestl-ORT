import React, { useState } from 'react';
import { formGetOrEmpty, splitOrDefault } from '../../utils/formUtils';
import { TextField } from '@mui/material';
import { Fallback } from '../../components/shared/Fallback';
import { useUsers } from '../../../stores';
import { SMFields } from '../../components/shared/SMFields';
import { FormDialog } from '../../components/shared/FormDialog';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';

export type UserPageProps = {
  open: boolean
  onClose: (() => void)
}

export const UserPage = (props: UserPageProps) => {
  const { user, editUser, saveUser } = useUsers();
  const [waitExecuting, setWaitExecuting] = useState(true);
  const { setSnackbarProps } = useSnackbarProps();
  
  const proccessForm = async (formJson: { [k: string]: any; }): Promise<void> => {
    const userRequest = {
      roles: splitOrDefault(formJson.roles),
      status: 'ACTIVE',
      custom: {
        catalogs: splitOrDefault(formJson.catalogs),
      },
    };

    if (user) {
      await editUser(user.id, userRequest);
    } else {
      await saveUser({ ...userRequest, username: formGetOrEmpty(formJson.email) });
    }
  };
  
  return (

    <FormDialog
      title={`${user ? "User edit" : "New user"}`}
      open={props.open} 
      onClose={props.onClose} 
      process={proccessForm} 
      afterSubmitHandler={() => {
        setSnackbarProps({ message: "User saved successfully" });
        props.onClose()
      }}>
      
      <Fallback testId="username-fallback" condition={waitExecuting}>
        <TextField
          disabled={!!user}
          fullWidth
          required
          id="email"
          data-testid="username"
          value={user?.username}
          label="Email"
          name="email"
          autoComplete="email" />
      </Fallback>

      <SMFields 
        afterLoadFunction={() => setWaitExecuting(false)}
        catalogs={user?.custom?.catalogs} 
        roles={user?.roles} />

    </FormDialog>

  );

  
};
