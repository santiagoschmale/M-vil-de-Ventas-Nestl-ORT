import React, { useEffect, useState } from 'react';
import { SMRoles } from '../SMRoles';

export type RoleOptions = {
    catalogs?: string[]
    roles?: string[]
    afterLoadFunction: Function
}

export const SMFields = (opt: RoleOptions) => {
    const [waitExecuting, setWaitExecuting] = useState(true);

    useEffect(() => { 
        opt.afterLoadFunction();
        setWaitExecuting(false);
    }, []);

    return (
        <>
            <SMRoles
              waitExecuting={waitExecuting}
              roles={opt.roles}
            />
        </>
    )
}