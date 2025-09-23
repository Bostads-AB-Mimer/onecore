export interface Property {
  id: string;
  name: string;
  address: string;
  postal_code?: string;
  city?: string;
  property_type?: string;
  created_at: string;
  updated_at: string;
}

export const sampleProperties: Property[] = [
  {
    id: "prop1",
    name: "Minken 1",
    address: "Vasagatan 12",
    postal_code: "411 24",
    city: "Göteborg",
    property_type: "Flerfamiljshus",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  },
  {
    id: "prop2", 
    name: "Bävern 2",
    address: "Storgatan 5",
    postal_code: "411 38",
    city: "Göteborg",
    property_type: "Flerfamiljshus",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  },
  {
    id: "prop3",
    name: "Räven 3",
    address: "Parkvägen 8", 
    postal_code: "412 51",
    city: "Göteborg",
    property_type: "Flerfamiljshus",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  },
];