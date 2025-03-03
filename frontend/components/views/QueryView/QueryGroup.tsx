import React from 'react';
import { TextField, Box } from '@material-ui/core/';
// import styled from 'styled-components'

interface QueryGroupProps {
  group?: string;
  onChange: (newGroup: string) => void;
}

const QueryGroup = ({ group, onChange }: QueryGroupProps) => (
  <Box>
    <TextField
      label="Group"
      value={group}
      onChange={(evt) => onChange(evt.target.value)}
    />
  </Box>
);
 
export default QueryGroup;
