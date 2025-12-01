# Leasing Service Scripts

## publish-external-parking-spaces.ts

This script publishes external (non-scored) parking spaces from the old system to OneCore.

### Purpose

The script:
1. Reads a JSON file containing parking spaces from the old system
2. Filters for parking spaces with `rentalObjectTypeCode: "POÄNGFRITT"` (external/non-scored parking spaces)
3. Fetches vacant parking spaces from the system
4. Creates NON_SCORED listings for all external parking spaces that are currently vacant

### Prerequisites

- The leasing service database must be accessible
- The property management service (Xpand) must be running for vacant parking space lookups
- You need access to a JSON file with parking spaces from the old system
- The parking spaces must exist and be vacant in the system

### Usage

```bash
# From the services/leasing directory
npx ts-node scripts/publish-external-parking-spaces.ts <path-to-json-file>

# Example with sample data:
npx ts-node scripts/publish-external-parking-spaces.ts scripts/sample-old-system-data.json
```

### Input Format

The JSON file should contain an array of parking space objects with the following structure:

```json
[
  {
    "objectTypeCode": "MCGAR",
    "objectTypeCaption": "Bilplats",
    "realEstateObjectTypeCaption": "Motorcykelgarage",
    "queuePoints": [],
    "numberOfApplications": 0,
    "publishedFrom": "2024-04-08T14:49:13",
    "publishedTo": null,
    "rentalObjectCode": "110-010-99-0015",
    "rentalObjectTypeCode": "POÄNGFRITT",
    "vacantFrom": "2019-09-01T00:00:00",
    "roomCount": 0,
    "noApplyReasons": ["NOT_LOGGED_IN"],
    "postalAddress": "Stångmärkesgatan 1",
    "zipCode": "722 10",
    "city": "VÄSTERÅS",
    "size": "4",
    "district": "Lillåudden",
    "districtCode": "LIL",
    "block": "FYRTORNET 2",
    "monthRent": "786,78",
    "vatIncluded": "155,00",
    "waitingListType": "Bilplats (extern)",
    "elevatorExists": false,
    "buildingYear": 2010,
    "tags": ["MCGAR"],
    "image": "https://pub.mimer.nu/bofaktablad/mediabank/byggnad/110-010-99_1.jpg"
  }
]
```

### Key Fields

- `rentalObjectCode`: The unique identifier for the parking space (required)
- `rentalObjectTypeCode`: Must be "POÄNGFRITT" for the space to be processed
- `publishedFrom`: When the listing should be published from (required)
- `publishedTo`: When the listing should expire (optional, can be null)
- `vacantFrom`: When the parking space becomes available (informational)

### Output

The script will output:
- Total number of parking spaces processed
- How many were already vacant in the system
- How many were not vacant (skipped)
- How many listings were successfully created
- How many failed
- Detailed error messages for any failures

Example output:
```
Publication process completed:
  Total processed: 3
  Already vacant in system: 2
  Not vacant (skipped): 1
  Successfully created: 2
  Failed: 0
```

### How It Works

1. **Read and Parse**: Reads the JSON file and parses parking space data from the old system
2. **Filter**: Keeps only parking spaces with `rentalObjectTypeCode: "POÄNGFRITT"` (external parking spaces)
3. **Fetch Vacant Spaces**: Calls the rental object adapter to get all vacant parking spaces from our system
4. **Compare by rentalObjectCode**: For each external parking space from the old system, checks if the same `rentalObjectCode` exists in our vacant parking spaces list
5. **Batch Create**: Creates NON_SCORED listings in batch for all matching parking spaces

**Important**: Only parking spaces that have the same `rentalObjectCode` in both:
- The old system data (with `rentalObjectTypeCode: "POÄNGFRITT"`)
- Our system's vacant parking spaces

...will get listings created. This ensures we only publish external parking spaces that actually exist and are available in our system.

### Created Listings

All created listings will have:
- `status: 'active'` - Active and ready for applications
- `rentalRule: 'NON_SCORED'` - No queue points, first come first served
- `listingCategory: 'PARKING_SPACE'` - Parking space category
- `publishedFrom`: Copied from old system data
- `publishedTo`: Copied from old system data (if provided)

### Error Handling

The script will:
- Skip parking spaces from the old system that don't have a matching `rentalObjectCode` in our vacant parking spaces
- Skip parking spaces that don't have `rentalObjectTypeCode: "POÄNGFRITT"`
- Log detailed errors for any failed listing creations
- Use batch creation with fallback to individual creation on conflicts
- Throw an error at the end if any listings failed to be created

The "Not vacant (skipped)" count refers to parking spaces from the old system that were not found in our system's vacant parking spaces list.

### Service Methods

The script uses methods from `publish-external-parking-spaces.ts` service:

- `getVacantParkingSpaces()`: Fetches all vacant parking spaces from the system
- `createMultipleListings()`: Creates listings in batch
- `publishExternalParkingSpaces()`: Main orchestration method

These methods are also available for use in other parts of the application.

### Notes

- The script uses the existing listing adapter which prevents duplicate listings
- Parking spaces must exist in Xpand and be marked as vacant
- The script creates listings in batch for better performance
- The database connection is properly closed after execution
- Failed listings are logged with details for troubleshooting
