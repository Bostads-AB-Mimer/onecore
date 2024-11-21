import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ 
  title, 
  icon: Icon, 
  children, 
  className = '', 
  onClick,
  hover = false
}: CardProps) {
  const CardComponent = hover ? motion.div : 'div';
  const cardProps = hover ? {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 }
  } : {};

  return (
    <CardComponent
      {...cardProps}
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {(title || Icon) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {Icon && <Icon className="h-5 w-5 text-gray-400" />}
        </div>
      )}
      {children}
    </CardComponent>
  );
}