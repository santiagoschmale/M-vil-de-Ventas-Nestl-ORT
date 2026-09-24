import React from "react";
import LeftMenu from "../../components/shared/LeftMenu/LeftMenu";

import { SnackbarGlobal } from "../../components/shared/SnackBar"
import Router from "../../Router"

export const Home = () => {
    return (
        <>
        <SnackbarGlobal />
        <div style={{ minWidth: '250px', display: 'flex', flexDirection: 'column', backgroundColor: '#E7E4E1' }}>
            <LeftMenu />
          </div>
          <div style={{ flexGrow:1, overflow: 'auto' }}>
            <Router />
          </div>
        </>
    )
}