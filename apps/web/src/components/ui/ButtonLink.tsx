import { Link } from 'react-router-dom';
import type { ComponentProps, ReactNode } from 'react';
import { buttonClasses } from './buttonStyles';

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  className?: string;
};

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
      {icon && <span className="ml-2 shrink-0">{icon}</span>}
    </Link>
  );
}
