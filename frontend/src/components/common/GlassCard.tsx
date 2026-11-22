import React from 'react';

export type GlassVariant = 'card' | 'chip' | 'pill';
export type GlassGlow = 'cyan' | 'red' | 'amber' | 'violet' | 'green';

interface GlassCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'nav' | 'aside' | 'header';
  variant?: GlassVariant;
  glow?: GlassGlow;
  interactive?: boolean;
  selected?: boolean;
  pulseCritical?: boolean;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<GlassVariant, string> = {
  card: 'glass-surface',
  chip: 'glass-surface-chip',
  pill: 'glass-surface-pill',
};

const GLOW_CLASSES: Record<GlassGlow, string> = {
  cyan: '',
  red: 'glass-glow-red',
  amber: 'glass-glow-amber',
  violet: 'glass-glow-violet',
  green: 'glass-glow-green',
};

export const GlassCard: React.FC<GlassCardProps> = ({
  as = 'div',
  variant = 'card',
  glow = 'cyan',
  interactive = false,
  selected = false,
  pulseCritical = false,
  className = '',
  children,
  ...rest
}) => {
  const Component = as;
  const selectedClass = selected
    ? glow === 'violet'
      ? 'glass-selected-violet'
      : 'glass-selected'
    : '';

  const classes = [
    VARIANT_CLASSES[variant],
    GLOW_CLASSES[glow],
    interactive ? 'glass-interactive' : '',
    selectedClass,
    pulseCritical ? 'pulse-critical-soft' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
};
