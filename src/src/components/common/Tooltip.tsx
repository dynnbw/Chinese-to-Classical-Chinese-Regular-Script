import { type ReactNode } from 'react';

interface Props {
  text: string;
  children: ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  return (
    <div className="tooltip">
      {children}
      <span className="tooltip-text">{text}</span>
    </div>
  );
}
