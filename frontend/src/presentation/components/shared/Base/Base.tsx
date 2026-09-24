import { Divider, Typography } from '@mui/material';

import React, { useEffect, useState } from 'react';
import { ConditionalRendering } from '../ConditionalRendering/ConditionalRendering';
import FilterTextField from '../FilterTextField/FilterTextField';

export type BaseProps = {
  title?: string
  content?: React.ReactNode
  actions?: React.ReactNode
  height?: string
  modal?: boolean
  filterFunction?: Function
}

const Base = (props: BaseProps) => {

  return (
    <>
        <div style={{display: 'flex', flexDirection: 'column', overflow: 'unset', height: props.height || '100vh'}}>
            
            <ConditionalRendering condition={!!props.title}>
            
              <div style={{display: 'flex', padding: props.modal ? '0px' : '20px', flexDirection: 'row' }}>
              
                <div style={{flexGrow: 1}}>
                  <Typography variant={props.modal ? 'h6' : 'h5'}>{props.title}</Typography>
                </div>
                
                <ConditionalRendering condition={!!props.filterFunction} >
                  <div>
                    <FilterTextField filter={props.filterFunction ?  props.filterFunction :  () => {} } />
                  </div>
                </ConditionalRendering>
              
              </div> 
            
            </ConditionalRendering>

            <ConditionalRendering condition={!props.modal && !!props.title}>
              <Divider style={{padding: '5px'}} variant="middle" />
            </ConditionalRendering>

            <div style={{flexGrow: 1, overflow: 'auto', padding: '20px'}}>
                {props.content}
            </div>

            <div style={{ padding: '30px', display: 'flex', justifyContent: 'flex-end', marginRight: '10px' }}>
              {props.actions}
            </div>
            
        </div>
    </>

  );
};

export default Base;
