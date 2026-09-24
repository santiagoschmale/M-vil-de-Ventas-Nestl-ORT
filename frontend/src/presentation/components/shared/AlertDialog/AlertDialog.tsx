
import * as React from 'react';
import { Button, Dialog, DialogActions, DialogTitle } from '@mui/material';
import { useSnackbarProps } from '../../../../stores/useSnackbarProps';

export type DeleteModalProps = {
    open: boolean,
    label: string,
    onClose: Function
    onConfirm: Function
    message?: string
}

export const AlertDialog = (props: DeleteModalProps) => {

  const {
    message
  } = props;

  const { setSnackbarProps } = useSnackbarProps();

  return (
      <Dialog maxWidth={"lg"} open={props.open} onClose={() => props.onClose()} >
        
        <DialogTitle sx={{padding: '20px'}}>
          Are you sure you want to delete {props.label} ?
        </DialogTitle>

        <DialogActions sx={{padding: '20px'}}>
          <Button variant='outlined' sx={{minWidth: "100px"}} onClick={async () => await props.onClose()} children="Cancel" />
          <Button 
            variant='contained'
            sx={{minWidth: "100px"}}
            children="Confirm"
            onClick={async () => {
              await props.onConfirm();
              await props.onClose();
              if(message) {
                setSnackbarProps({message})
              }
            }} />
        </DialogActions>

      </Dialog>

  )
}

export default AlertDialog;