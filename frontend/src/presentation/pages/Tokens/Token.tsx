import React, { useState } from 'react';
import { splitOrDefault } from '../../utils/formUtils';
import { TextField } from '@mui/material';
import { Fallback } from '../../components/shared/Fallback';
import { useTokens } from '../../../stores/useTokens';
import { SMFields } from '../../components/shared/SMFields';
import { ConditionalRendering } from '../../components/shared/ConditionalRendering/ConditionalRendering';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';
import { FormDialog } from '../../components/shared/FormDialog';

export type TokenProps = {
  open: boolean
  onClose: (() => void)
}

export const TokenPage = (props: TokenProps) => {
  const { token, newToken, updateToken } = useTokens();
  const [waitExecuting, setWaitExecuting] = useState(true);
  const editing = token ? true : false
  const { setSnackbarProps } = useSnackbarProps();
  

  const proccessForm = async (formJson: { [k: string]: any; }) => {
    const tokenRequest = {
      roles: splitOrDefault(formJson.roles),
      custom: {
        catalogs: splitOrDefault(formJson.catalogs),
      },
    }

    if(token) {
      await updateToken(token.id, tokenRequest);
    } else {
      await newToken(tokenRequest);
    }  
  
  };    

  return (
    <FormDialog
      title={`${token ? "Token edit" : "New Token"}`}
      open={props.open} 
      onClose={props.onClose} 
      process={proccessForm} 
      afterSubmitHandler={() => {
        setSnackbarProps({ message: "Token saved successfully" });
        props.onClose()
      }}>

      <ConditionalRendering condition={!!token}>
        <Fallback
          testId="token-fallback"
          condition={waitExecuting}>
            <TextField
              fullWidth
              disabled={undefined !== token?.key}
              hidden={!editing}
              style={{visibility: editing ? 'visible' : 'hidden'}}
              id="key"
              data-testid="key"
              value={token?.key}
              label="Key"
              name="key"
            />
        </Fallback>
      </ConditionalRendering>

      <SMFields 
        afterLoadFunction={() => setWaitExecuting(false)}
        catalogs={token?.custom?.catalogs} 
        roles={token?.roles}
      />
      
    </FormDialog>

  );
};
