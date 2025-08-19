# Core Service - Multiple Listings API Examples

This document provides examples of how to use the Core Service's `/listings/batch` endpoint to create multiple listings through the Core API.

## Endpoint

**POST** `<core-service-url>/listings/batch`

## Authentication

Include your Bearer token in the Authorization header:
```
Authorization: Bearer your-jwt-token-here
```

## Request Body Format

The Core Service endpoint accepts the same format as the Leasing Service but processes it through the core service layer:

```json
{
  "listings": [
    {
      "rentalObjectCode": "string",
      "publishedFrom": "2024-01-01T00:00:00Z",
      "publishedTo": "2024-12-31T23:59:59Z",
      "status": 1,
      "rentalRule": "SCORED",
      "listingCategory": "PARKING_SPACE"
    }
  ]
}
```

### Field Descriptions

- `rentalObjectCode`: Unique identifier for the rental object
- `publishedFrom`: Start date when the listing becomes active (ISO 8601 format)
- `publishedTo`: End date when the listing expires (ISO 8601 format)  
- `status`: Listing status (numeric enum):
  - `1` = Active
  - `2` = Assigned
  - `3` = Closed
  - `4` = Expired
  - `5` = NoApplicants
- `rentalRule`: Rental rule - either `SCORED` or `NON_SCORED`
- `listingCategory`: Category - one of: `PARKING_SPACE`, `APARTMENT`, `STORAGE`

## cURL Examples

### Example 1: Create Multiple Parking Space Listings

```bash
curl -X POST "http://localhost:3001/listings/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token-here" \
  -d '{
    "listings": [
      {
        "rentalObjectCode": "P001",
        "publishedFrom": "2024-01-01T00:00:00Z",
        "publishedTo": "2024-12-31T23:59:59Z",
        "status": 1,
        "rentalRule": "SCORED",
        "listingCategory": "PARKING_SPACE"
      },
      {
        "rentalObjectCode": "P002",
        "publishedFrom": "2024-01-01T00:00:00Z",
        "publishedTo": "2024-12-31T23:59:59Z",
        "status": 1,
        "rentalRule": "NON_SCORED",
        "listingCategory": "PARKING_SPACE"
      },
      {
        "rentalObjectCode": "P003",
        "publishedFrom": "2024-02-01T00:00:00Z",
        "publishedTo": "2024-11-30T23:59:59Z",
        "status": 1,
        "rentalRule": "SCORED",
        "listingCategory": "PARKING_SPACE"
      }
    ]
  }'
```

### Example 2: Create Mixed Category Listings

```bash
curl -X POST "http://localhost:3001/listings/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token-here" \
  -d '{
    "listings": [
      {
        "rentalObjectCode": "A001",
        "publishedFrom": "2024-01-15T00:00:00Z",
        "publishedTo": "2024-12-15T23:59:59Z",
        "status": 1,
        "rentalRule": "SCORED",
        "listingCategory": "APARTMENT"
      },
      {
        "rentalObjectCode": "S001",
        "publishedFrom": "2024-01-01T00:00:00Z",
        "publishedTo": "2024-12-31T23:59:59Z",
        "status": 1,
        "rentalRule": "NON_SCORED",
        "listingCategory": "STORAGE"
      }
    ]
  }'
```

## JavaScript/Node.js Examples

### Using fetch API

```javascript
async function createMultipleListings(listings, authToken) {
  try {
    const response = await fetch('http://localhost:3001/listings/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ listings })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating listings:', errorData);
      return null;
    }

    const result = await response.json();
    console.log('Successfully created listings:', result);
    return result;
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}

// Example usage with Core Service (note the numeric status values)
const listingsData = [
  {
    rentalObjectCode: 'P005',
    publishedFrom: '2024-01-01T00:00:00Z',
    publishedTo: '2024-12-31T23:59:59Z',
    status: 1, // Active
    rentalRule: 'SCORED',
    listingCategory: 'PARKING_SPACE'
  },
  {
    rentalObjectCode: 'P006',
    publishedFrom: '2024-01-01T00:00:00Z',
    publishedTo: '2024-12-31T23:59:59Z',
    status: 1, // Active
    rentalRule: 'NON_SCORED',
    listingCategory: 'PARKING_SPACE'
  }
];

createMultipleListings(listingsData, 'your-jwt-token-here');
```

### Using axios

```javascript
const axios = require('axios');

async function createMultipleListings(listings, authToken) {
  try {
    const response = await axios.post('http://localhost:3001/listings/batch', 
      { listings },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    console.log('Successfully created listings:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else {
      console.error('Network error:', error.message);
    }
    return null;
  }
}
```

## Response Formats

### Success Response (201)
The Core Service returns listings with rental objects attached when possible:

```json
{
  "content": [
    {
      "id": 1,
      "rentalObjectCode": "P001",
      "publishedFrom": "2024-01-01T00:00:00.000Z",
      "publishedTo": "2024-12-31T23:59:59.000Z",
      "status": 1,
      "rentalRule": "SCORED",
      "listingCategory": "PARKING_SPACE",
      "applicants": [],
      "rentalObject": {
        "rentalObjectCode": "P001",
        "address": "Example Street 123",
        "monthlyRent": 500,
        "residentialAreaCode": "12345",
        "residentialAreaCaption": "Example Area",
        "districtCaption": "Example District",
        "districtCode": "1",
        "objectTypeCaption": "Parkeringsplats",
        "objectTypeCode": "PPLATS",
        "vacantFrom": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "message": "Successfully created 1 listings"
}
```

### Partial Success Response (207)
```json
{
  "error": "Some listings failed to create",
  "message": "Partial success - some listings were created successfully while others failed"
}
```

### Validation Error Response (400)
```json
{
  "error": "Invalid request body",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["listings", 0, "rentalObjectCode"],
      "message": "Required"
    }
  ]
}
```

## Key Differences from Leasing Service Direct Access

1. **Status Values**: Core Service uses numeric enum values (1-5) instead of string values
2. **Enhanced Response**: Core Service attempts to attach rental objects to the created listings
3. **Graceful Degradation**: If rental objects can't be fetched, listings are still returned without them
4. **Unified API**: Goes through the core service layer for consistent authentication and logging

## Test Data

Here are some test data examples you can use:

### Valid Test Data

```javascript
const testData = {
  listings: [
    {
      rentalObjectCode: 'TEST001',
      publishedFrom: '2024-01-01T00:00:00Z',
      publishedTo: '2024-12-31T23:59:59Z',
      status: 1, // Active
      rentalRule: 'SCORED',
      listingCategory: 'PARKING_SPACE'
    },
    {
      rentalObjectCode: 'TEST002',
      publishedFrom: '2024-01-01T00:00:00Z',
      publishedTo: '2024-12-31T23:59:59Z',
      status: 1, // Active
      rentalRule: 'NON_SCORED',
      listingCategory: 'APARTMENT'
    }
  ]
}
```

### Large Batch Test Data (10 listings)

```javascript
const largeBatchData = {
  listings: Array.from({ length: 10 }, (_, index) => ({
    rentalObjectCode: `BATCH_${String(index + 1).padStart(3, '0')}`,
    publishedFrom: '2024-01-01T00:00:00Z',
    publishedTo: '2024-12-31T23:59:59Z',
    status: 1, // Active
    rentalRule: index % 2 === 0 ? 'SCORED' : 'NON_SCORED',
    listingCategory: 'PARKING_SPACE'
  }))
}
```

## Error Handling

The Core Service endpoint provides the same error handling as the Leasing Service but with additional layers:

1. **Validation Errors (400)**: Invalid request body format
2. **Partial Failures (207)**: Some listings created, others failed
3. **Service Unavailable (500)**: Core or Leasing service errors

Always check response status codes and handle each scenario appropriately.
