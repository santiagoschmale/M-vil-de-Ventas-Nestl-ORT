import React, { ReactElement } from 'react';

type ConditionalRenderingProps = {
  condition: boolean;
  children: ReactElement<any, any>
};

export const ConditionalRendering: React.FC<ConditionalRenderingProps> = (props: ConditionalRenderingProps) => props.condition ? props.children : null;