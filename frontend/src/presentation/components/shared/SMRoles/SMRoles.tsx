import React from 'react';
import { Fallback } from "../Fallback"
import { MultiSelect } from "../Multiselect"

export type RoleOptions = {
    waitExecuting: boolean,
    roles?: string[]
}

export const SMRoles = (opt: RoleOptions) => {

    return (
        <Fallback
          testId="roles-fallback"
          condition={opt.waitExecuting}
          >
          <MultiSelect
            name="roles"
            label="Roles *"
            required
            values={opt.roles}
            options={[
              { label: 'Admin', value: 'sm-admin' },
              { label: 'Read Only', value: 'readonly' },
            ]}
          />
        </Fallback>
    )
}