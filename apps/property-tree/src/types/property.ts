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
}

export interface PropertyResponse {
  content: Property[];
}
