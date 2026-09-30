import React, { HTMLAttributeAnchorTarget, MouseEventHandler, ReactNode } from 'react';
import { CircularProgress } from '@mui/material';
import { ActionButtonStyle } from './ActionButton.styles';
import CircularProgressWithLabel from '../CircularProgressWithLabel/CircularProgressWithLabel';

type ActionButtonProps = {
    children: ReactNode;
    disabled?: boolean
    loading?: boolean
    progress?: number
    color?: "inherit" | "secondary" | "primary" | "success" | "error" | "info" | "warning"
}

export type SubmitButtonProps = ActionButtonProps & {
    type: "submit"
}

export type LabelButtonProps = ActionButtonProps & {
    component: "label"
}

export type OnClickButtonProps = ActionButtonProps & {
    onClick?: MouseEventHandler
}

export type HrefButtonProps = ActionButtonProps & {
    href: string
    target: HTMLAttributeAnchorTarget
}

const ActionButton = (props: SubmitButtonProps| LabelButtonProps | OnClickButtonProps | HrefButtonProps) => {

  const loading = !props.loading ? undefined : props.progress != undefined ? <CircularProgressWithLabel value={props.progress} sx={{marginRight: '10px'}} size={25} /> : <CircularProgress sx={{marginRight: '10px'}} size={15} />

   return(
        <ActionButtonStyle 
            {...props}
            variant='contained'
            size='large'
            disabled={props.disabled || props.loading} 
            color={props.color || 'primary'}>
              {loading}
              {props.children}
        </ActionButtonStyle>
    )
}

export default ActionButton;