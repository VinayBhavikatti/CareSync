import React from 'react';
import type { Role } from '../types';
import { ROLE_COLORS, ROLE_LABELS } from '../types';

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-base font-semibold ${ROLE_COLORS[role]} ${className}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

