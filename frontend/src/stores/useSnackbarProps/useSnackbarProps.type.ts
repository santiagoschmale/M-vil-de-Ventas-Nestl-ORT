import { AlertColor } from "@mui/material";

export type SnackbarProps = {
  message: string;
  severity?: AlertColor;
};

export type UseSnackbarProps = {
  snackbarProps: SnackbarProps | undefined;
  setSnackbarProps: (props: SnackbarProps | undefined) => void;
};
