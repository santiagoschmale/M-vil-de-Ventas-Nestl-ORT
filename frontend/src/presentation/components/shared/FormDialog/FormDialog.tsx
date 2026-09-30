import { AppBar, Box, Button, Dialog, DialogActions, DialogContent, IconButton, Modal, Toolbar, Typography } from '@mui/material';
import React from 'react';
import CloseIcon from '@mui/icons-material/Close';

export type DialogProps = {
  onClose: (() => void);
  children: React.ReactNode
  actions?: React.ReactNode
  open: boolean
  title: string
  process: (formJson: { [k: string]: any; }) => Promise<void>
  afterSubmitHandler: Function
}

const FormDialog = (props: DialogProps) => {

  return (
    <Dialog   
      open={props.open}
      onClose={props.onClose}
      fullWidth={true}
      maxWidth={"lg"}
      PaperProps={{
        component: 'form',
        sx: {minHeight: "500px"},
        onSubmit: async (event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const formJson = Object.fromEntries((formData as any).entries());
          await props.process(formJson)
          props.afterSubmitHandler()
        },
      }}
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={props.onClose} aria-label="close" children={<CloseIcon />} />
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div" children={props.title} />  
          </Toolbar>
        </AppBar>
        
        <DialogContent>
          <Box display="flex" alignItems="center" flexDirection={'column'} gap={2} padding={3} >
            {props.children}
          </Box>
        </DialogContent>

        <DialogActions sx={{padding: '20px'}}>
            <Button autoFocus sx={{minWidth: "100px"}} color="primary" variant='contained' type="submit" children={"save"} />
        </DialogActions>
       
    </Dialog>
  );
};

export default FormDialog;
