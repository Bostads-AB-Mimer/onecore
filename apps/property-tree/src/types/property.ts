export interface PropertyLink {
  self: {
    href: string;
  };
}

export interface Property {
  propertyId: string;
  propertyCode: string;
  tract: string;
  propertyDesignation: string;
  _links: PropertyLink;
  // Derived fields for UI
  id: string;
  name: string;
  buildings?: string[];
}

export interface PropertyResponse {
  content: Property[];
}
