import { Button } from '@react-email/components';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function EmailButton({
  href,
  children,
  variant = 'primary',
}: EmailButtonProps) {
  const styles =
    variant === 'primary'
      ? {
          backgroundColor: '#7c2d12',
          color: '#ffffff',
        }
      : {
          backgroundColor: '#f3f4f6',
          color: '#374151',
        };

  return (
    <Button
      href={href}
      style={{
        ...styles,
        padding: '12px 24px',
        borderRadius: '6px',
        textDecoration: 'none',
        display: 'inline-block',
        fontWeight: '600',
        fontSize: '14px',
        textAlign: 'center' as const,
      }}
    >
      {children}
    </Button>
  );
}
