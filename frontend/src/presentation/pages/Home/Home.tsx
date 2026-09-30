import React, { useEffect, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LeftMenu from "../../components/shared/LeftMenu/LeftMenu";

import { SnackbarGlobal } from "../../components/shared/SnackBar"
import Router from "../../Router"

const CLAVE = "menu-oculto";

// Preferencia de este navegador; si el almacenamiento no está disponible, el menú arranca visible.
const leerOculto = () => {
  try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; }
};

export const Home = () => {
    const [oculto, setOculto] = useState(leerOculto);
    useEffect(() => {
      try { localStorage.setItem(CLAVE, oculto ? "1" : "0"); } catch { /* sin almacenamiento: no se recuerda */ }
    }, [oculto]);

    return (
        <>
        <SnackbarGlobal />
        {oculto ? (
          // Oculto: queda solo el botón para volver a mostrarlo, como el panel lateral de Claude.
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 4px', backgroundColor: '#E7E4E1' }}>
            <Tooltip title="Mostrar menú" placement="right">
              <IconButton aria-label="Mostrar menú" aria-expanded={false} onClick={() => setOculto(false)}>
                <MenuRoundedIcon />
              </IconButton>
            </Tooltip>
          </div>
        ) : (
          <div style={{ minWidth: '250px', display: 'flex', flexDirection: 'column', backgroundColor: '#E7E4E1', position: 'relative' }}>
            <Tooltip title="Ocultar menú" placement="right">
              <IconButton aria-label="Ocultar menú" aria-expanded={true} onClick={() => setOculto(true)}
                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                <MenuOpenRoundedIcon />
              </IconButton>
            </Tooltip>
            <LeftMenu />
          </div>
        )}
          <div style={{ flexGrow:1, overflow: 'auto' }}>
            <Router />
          </div>
        </>
    )
}
