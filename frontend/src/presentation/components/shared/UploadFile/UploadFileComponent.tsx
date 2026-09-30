import React, { useRef, useState } from 'react';
import { api } from '../../../../infra/http';
import { useSnackbarProps } from '../../../../stores/useSnackbarProps';
import ActionButton from '../ActionButton/ActionButton';
import { VisuallyHiddenInput } from './UploadFileComponent.styles';

export type UploadFileProps = {
  fileType: string
  fileName: string
  url: string
  label: string
  successMessage: string
  errorMessage: string
}


export const UploadFileComponent = (props: UploadFileProps) => {
  const fileInputRef = useRef<any>();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const { setSnackbarProps } = useSnackbarProps();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const data = new FormData();
    setLoading(true)
    data.append('file', event.target.files?.[0] as File, props.fileName);

    api.upload(props.url, data, (percent:number) => {
      setProgress(percent)
    })
    .then(() => {
      setProgress(0)
      setLoading(false)
      setSnackbarProps({ message: props.successMessage, severity: 'success'})
    })
    .catch(() => {
      setProgress(0)
      setLoading(false)
      setSnackbarProps({ message: props.errorMessage, severity: 'error'})
    })

  };

  return (
    <ActionButton loading={loading} component={"label"} progress={progress}>
      {props.label}
      
      <VisuallyHiddenInput
        id="uploadInput"
        data-testid="uploadInput"
        type="file"
        ref={fileInputRef}
        accept={props.fileType}
        hidden
        onChange={handleUpload} />
    
    </ActionButton>
  )
};
