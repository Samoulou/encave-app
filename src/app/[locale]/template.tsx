import { ReactNode } from 'react';

interface TemplateProps {
  children: ReactNode;
}

export default function Template({ children }: TemplateProps) {
  return <>{children}</>;
}
