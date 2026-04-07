
# ONECore - Contacts Microservice

Microservice providing the canonical source of contact and customer data in the ONECore platform.

# Overview

## Service

The service provides:
 
- **/contacts** - The contacts API. Search for or retrieve contact data by wildcard, canonical ID, phone number, etc
- **/health** - Health and diagnostics endpoints
- **/swagger** - Swagger UI

## Application Architecture

### Inversion of Control

This module employs a simplistic variant of Inversion-of-Control to wire itself up, meaning that all collaborators
and dependencies are created up front and each module/layer is provided their required collaborators up front.

This enables:

- Any slice of the application can be used and tested in isolation without mock-gymnastics.
- No runaway import-with-side-effects, except for the application entry point.
- Firing up full application instances with granular control of configuration doesn't have to rely on global state

### Route schemas as code

Unlike the rest of the platform, at the time of writing, this application does not rely on **swagger-jsdoc** and
instead uses **koa-okapi-router** that allows defining Koa routes as schema objects that provide type-safety to the
Koa Context and servce as the source for generating the openapi.json/swagger.json.

### Data Source

This module defines a **ContactRepository** interface, of which one implementation exists - **xpand**.

The data quality of the production source is, for lack of better words, all over the place. 
The bulk of the application deals with making the unstructured information searchable and presentable.
For any meaningful testing, manual or automated, you will need a data set that is production-like. 

### Build

This module builds as both **cjs** and **esm**, serving as a pilot within the platform for moving away
from the legacy of **cjs**. The green-ness of the **esm** grass may have been over-advertised.

## Test setup

There are two types of automated tests:
- **Plain unit tests** that focus mainly on data transformation and inference.
- **End-to-End tests** that apply their own data sets to the database, start an application on a random port and perform HTTP requests.

#### de:apply-seed

This script will clean out the local database and apply the full data set from `seed.sql`.

This is useful for quickly adding data while testing in development mode, but running the test suite will 
clean out, repopulate and trim the database.

A number of end-to-end tests rely on a **known data set** so test failures are to be expected if you
modify the set in `seed.sql` for manual testing.

## License

© 2026 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
