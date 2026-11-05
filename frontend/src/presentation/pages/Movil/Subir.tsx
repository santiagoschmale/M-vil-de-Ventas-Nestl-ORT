import React from 'react';
import { Button } from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';

/** Botón para elegir un Excel (.xlsx o .xlsb) y subirlo. */
export const Subir = ({ cargado, etiqueta, alElegir, texto, secundario }: {
  cargado: boolean; etiqueta: string; alElegir: (f: File) => void; texto?: string;
  secundario?: boolean; // sin borde: cuando al lado hay una acción más usada
}) => {
  const { ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  return (
    <Button component="label" variant={secundario ? 'text' : 'outlined'} size="small" startIcon={<UploadFileRoundedIcon />}
      disabled={ocupado || soloLectura}>
      {texto ?? (cargado ? 'Reemplazar' : 'Subir Excel')}
      <input
        hidden type="file" accept=".xlsx,.xlsb" aria-label={etiqueta}
        onChange={e => { const f = e.target.files?.[0]; if (f) alElegir(f); e.target.value = ''; }}
      />
    </Button>
  );
};
