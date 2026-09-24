/* eslint-disable react/destructuring-assignment */
import * as React from 'react';
import {
  Select,
  OutlinedInput,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  MenuItem,
} from '@mui/material';
import { useState } from 'react';

export type MultiSelectOptions = {
  id?: string;
  name: string;
  label: string;
  required?: boolean;
  values?: string[];
  options: {
    label: string;
    value: string;
  }[];
};

export const MultiSelect = (opt: MultiSelectOptions) => {
  const [values, setSelected] = useState<string[]>(opt.values || []);

  const handleChange = (event: SelectChangeEvent<typeof values>) => {
    const {
      target: { value },
    } = event;

    setSelected(value as string[]);
  };

  return (
    <FormControl fullWidth>
      <InputLabel id={`${opt.name}-label`}>{opt.label}</InputLabel>
      <Select
        labelId={`${opt.name}-label`}
        id={opt.id}
        name={opt.name}
        data-testid={opt.name}
        multiple
        value={values}
        required={opt.required}
        onChange={handleChange}
        input={<OutlinedInput label={opt.label} />}
      >
        {opt.options.map(option => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
