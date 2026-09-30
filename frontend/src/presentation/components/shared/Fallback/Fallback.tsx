import React from 'react';
import { Skeleton } from '@mui/material';

type FallbackProps = {
  condition: boolean;
  fallback?: any;
  testId?: string;
  children: React.ReactNode;
  variant?: "text" | "rectangular" | "rounded" | "circular"
};

export const Fallback: React.FC<FallbackProps> = (props: FallbackProps) =>
props.condition ? props.fallback || <Skeleton data-testid={props.testId} variant={props.variant || "text"} /> : props.children;
