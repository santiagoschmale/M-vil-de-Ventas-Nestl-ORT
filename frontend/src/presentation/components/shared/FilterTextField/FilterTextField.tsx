import { TextField, InputAdornment } from '@mui/material';
import React, { useEffect, useState } from 'react';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

export type FilterTextFieldProps = {
    filter: Function
  }

const FilterTextField: React.FC<FilterTextFieldProps> = (props: FilterTextFieldProps) => {

    const filter = props.filter
    const [inputValue, setInputValue] = useState('')

    useEffect(() => {
      const timer = setTimeout(() => { filter(inputValue) }, 1000)
      return () => clearTimeout(timer)
    }, [inputValue])
    
    return (
        <TextField 
            variant="standard" 
            onChange={e => setInputValue(e.target.value)}  
            InputProps={{ startAdornment: ( <InputAdornment position="start"> <SearchRoundedIcon /> </InputAdornment> ) }} />
    )
         
};

export default FilterTextField
