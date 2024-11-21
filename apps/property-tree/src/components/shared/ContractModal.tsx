import React from 'react';
import { Modal } from '../ui/Modal';
import { InfoItem } from '../ui/InfoItem';
import { Calendar, Home, FileText, User2, CreditCard } from 'lucide-react';
import { Button } from '../ui/Button';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: {
    name: string;
    email: string;
    phone: string;
    moveInDate: string;
    apartmentId: string;
  };
  apartment: {
    rent: number;
    size: number;
    bedrooms: number;
  };
}

export function ContractModal({ isOpen, onClose, tenant, apartment }: ContractModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hyreskontrakt"
      footer={
        <div className="flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Stäng
          </Button>
          <Button
            variant="primary"
            icon={FileText}
          >
            Ladda ner kontrakt
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Hyresgästinformation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem
              icon={User2}
              label="Namn"
              value={tenant.name}
            />
            <InfoItem
              icon={Calendar}
              label="Inflyttningsdatum"
              value={tenant.moveInDate}
            />
            <InfoItem
              icon={Home}
              label="Lägenhetsnummer"
              value={tenant.apartmentId}
            />
            <InfoItem
              icon={CreditCard}
              label="Månadshyra"
              value={`${apartment.rent} kr`}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Kontraktsinformation
          </h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Kontraktslängd</span>
              <span className="text-sm font-medium">Tillsvidare</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Uppsägningstid</span>
              <span className="text-sm font-medium">3 månader</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Deposition</span>
              <span className="text-sm font-medium">{apartment.rent} kr</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Lägenhetsspecifikation
          </h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Storlek</span>
              <span className="text-sm font-medium">{apartment.size} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Antal rum</span>
              <span className="text-sm font-medium">{apartment.bedrooms} rum och kök</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Balkong</span>
              <span className="text-sm font-medium">Ja</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Detta är en digital kopia av hyreskontraktet. Det signerade originalet finns arkiverat hos fastighetsförvaltningen.
          </p>
        </div>
      </div>
    </Modal>
  );
}