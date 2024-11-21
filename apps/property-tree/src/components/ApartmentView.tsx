import React from 'react';
import { motion } from 'framer-motion';
import { 
  BedDouble, 
  Home, 
  Mail, 
  Phone, 
  Square, 
  User2, 
  CalendarClock,
  Building2,
  ArrowUpRight,
  MoreHorizontal,
  MessageSquare
} from 'lucide-react';

interface ApartmentViewProps {
  apartment: {
    id: string;
    address: string;
    size: number;
    bedrooms: number;
    rent: number;
    tenant: {
      name: string;
      email: string;
      phone: string;
      moveInDate: string;
    };
  };
}

export function ApartmentView({ apartment }: ApartmentViewProps) {
  return (
    <div className="p-8 animate-in">
      <div className="mb-8 flex justify-between items-center">
        <nav className="flex space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Hem</span>
          <span>/</span>
          <span>Fastigheter</span>
          <span>/</span>
          <span>Västerås</span>
          <span>/</span>
          <span>Storgatan 1</span>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">{apartment.id}</span>
        </nav>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-300 ease-out"
        >
          <MoreHorizontal className="h-5 w-5 text-gray-500" />
        </motion.button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-800/90 dark:to-gray-900/80 rounded-xl shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 backdrop-blur-xl p-6 border border-gray-200/30 dark:border-gray-700/30 hover:shadow-xl hover:border-gray-300/50 dark:hover:border-gray-600/50 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold mb-2 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-800 dark:from-white dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent">
                  {apartment.bedrooms} rum och kök, {apartment.id}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 flex items-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  Bostadslägenhet
                </p>
              </div>
              <motion.span 
                whileHover={{ scale: 1.05 }}
                className="px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium backdrop-blur-sm border border-blue-200/30 dark:border-blue-700/30 shadow-sm"
              >
                {apartment.size} m²
              </motion.span>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6">
              {[
                { icon: Square, label: 'Storlek', value: `${apartment.size} m²` },
                { icon: BedDouble, label: 'Sovrum', value: apartment.bedrooms },
                { icon: Home, label: 'Hyra', value: `${apartment.rent} kr/månad` },
                { icon: CalendarClock, label: 'Inflyttning', value: apartment.tenant.moveInDate }
              ].map((item, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-center space-x-3 group"
                >
                  <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-700/50 rounded-lg group-hover:from-gray-100 group-hover:to-gray-200/50 dark:group-hover:from-gray-700 dark:group-hover:to-gray-600/50 transition-all duration-300 shadow-sm">
                    <item.icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="font-medium">{item.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-800/90 dark:to-gray-900/80 rounded-xl shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 backdrop-blur-xl p-6 border border-gray-200/30 dark:border-gray-700/30 hover:shadow-xl hover:border-gray-300/50 dark:hover:border-gray-600/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Lägenhetshistorik</h2>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                Visa alla
              </motion.button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-700/50 rounded-lg backdrop-blur-sm">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Inga tidigare ärenden registrerade
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className="bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-800/90 dark:to-gray-900/80 rounded-xl shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 backdrop-blur-xl p-6 border border-gray-200/30 dark:border-gray-700/30 hover:shadow-xl hover:border-gray-300/50 dark:hover:border-gray-600/50 transition-all duration-300">
            <h2 className="text-lg font-semibold mb-6">Hyresgästinformation</h2>
            
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="h-12 w-12 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg shadow-blue-500/20"
                >
                  {apartment.tenant.name.charAt(0)}
                </motion.div>
                <div>
                  <p className="font-medium">{apartment.tenant.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nuvarande hyresgäst</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { icon: Mail, value: apartment.tenant.email },
                  { icon: Phone, value: apartment.tenant.phone }
                ].map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center space-x-3 text-sm group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-all duration-300"
                  >
                    <item.icon className="h-4 w-4 text-gray-500 group-hover:text-blue-500 transition-colors duration-300" />
                    <span className="group-hover:text-blue-500 transition-colors duration-300">{item.value}</span>
                  </motion.div>
                ))}
              </div>

              <div className="pt-4 border-t dark:border-gray-700/50 space-y-3">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <span>Visa full profil</span>
                  <ArrowUpRight className="h-4 w-4" />
                </motion.button>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-900 dark:text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Skicka meddelande</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}