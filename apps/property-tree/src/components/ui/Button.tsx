import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  icon: Icon, 
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center space-x-2';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-600/30',
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm hover:shadow-md',
    outline: 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </motion.button>
  );
}