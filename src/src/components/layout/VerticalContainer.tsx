import { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/** 竖排布局容器，桌面端 writing-mode: vertical-rl, 移动端自动切换 */
export default function VerticalContainer({ children }: Props) {
  return <>{children}</>;
}
