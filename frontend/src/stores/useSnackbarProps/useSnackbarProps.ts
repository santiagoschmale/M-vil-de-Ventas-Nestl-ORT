import { create } from 'zustand';
import { SnackbarProps, UseSnackbarProps } from './useSnackbarProps.type';

export const useSnackbarProps = create<UseSnackbarProps>(set => ({
  snackbarProps: undefined,
  setSnackbarProps: (props: SnackbarProps | undefined) => {
    set({ snackbarProps: props });
  },
}));
