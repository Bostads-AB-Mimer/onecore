import React from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home,
  Square,
  BedDouble,
  Wallet,
  CalendarClock,
  FileText,
  Mail,
  Phone
} from 'lucide-react';
import { propertyService } from '../../services/propertyService';
import { Apartment } from '../../services/types';
import { ViewHeader } from '../shared/ViewHeader';
import { Card } from '../ui/Card';
import { Grid } from '../ui/Grid';
import { RoomCard } from '../shared/RoomCard';
import { ActiveIssues } from '../shared/ActiveIssues';
import { StatCard } from '../shared/StatCard';
import { Button } from '../ui/Button';
import { ContractModal } from '../shared/ContractModal';

export function ApartmentView() {
  const { apartmentId } = useParams();
  const [apartment, setApartment] = React.useState<Apartment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showContract, setShowContract] = React.useState(false);

  React.useEffect(() => {
    const loadApartment = async () => {
      try {
        const data = await propertyService.getApartment(apartmentId!);
        setApartment(data);
      } finally {
        setLoading(false);
      }
    };
    loadApartment();
  }, [apartmentId]);

  if (loading) {
    return (
      <div className="p-8 animate-in">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />
        
        <Grid cols={4} className="mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </Grid>

        <Grid cols={2}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </Grid>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Lägenhet hittades inte
        </h2>
      </div>
    );
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={`${apartment.bedrooms} rum och kök, ${apartment.id}`}
        subtitle={apartment.address}
        type="Lägenhet"
        icon={Home}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Storlek"
          value={`${apartment.size} m²`}
          icon={Square}
        />
        <StatCard
          title="Sovrum"
          value={apartment.bedrooms}
          icon={BedDouble}
        />
        <StatCard
          title="Hyra"
          value={`${apartment.rent} kr/mån`}
          icon={Wallet}
        />
        <StatCard
          title="Inflyttning"
          value={apartment.tenant.moveInDate}
          icon={CalendarClock}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <Card title="Rum och ytor">
            <Grid cols={2}>
              {apartment.rooms.map((room) => (
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  apartmentId={apartment.id}
                />
              ))}
            </Grid>
          </Card>

          {apartment.activeIssues.length > 0 && (
            <ActiveIssues issues={apartment.activeIssues} />
          )}
        </div>

        <div className="space-y-6">
          <Card title="Hyresgästinformation">
            <div className="flex items-center space-x-4 mb-6">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="h-12 w-12 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg shadow-blue-500/20"
              >
                {apartment.tenant.name.charAt(0)}
              </motion.div>
              <div>
                <p className="font-medium">{apartment.tenant.name}</p>
                <p className="text-sm text-gray-500">Nuvarande hyresgäst</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-300">
                <CalendarClock className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500">Inflyttningsdatum</p>
                  <p className="font-medium group-hover:text-blue-500 transition-colors">
                    {apartment.tenant.moveInDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-300">
                <Mail className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500">E-post</p>
                  <p className="font-medium group-hover:text-blue-500 transition-colors">
                    {apartment.tenant.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-300">
                <Phone className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <p className="font-medium group-hover:text-blue-500 transition-colors">
                    {apartment.tenant.phone}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700">
                <Button
                  variant="primary"
                  icon={FileText}
                  className="w-full"
                  onClick={() => setShowContract(true)}
                >
                  Visa kontrakt
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      <ContractModal
        isOpen={showContract}
        onClose={() => setShowContract(false)}
        tenant={apartment.tenant}
        apartment={apartment}
      />
    </div>
  );
}