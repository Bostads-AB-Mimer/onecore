# Response types 

The types in this directory have evolved from the need to share more specific response types between the onecore services, as opposed to the more generic types found in ´types.ts`.

The general rule for a type in this directory is that it is shared between services and that it contains special properties not fit for generic usage in `types.ts`. Local types with no dependencies between services should be kept local.  

First and foremost the usage of the types should be that of a response body, but it is not a given rule. 

## Guidelines for adding new types

* For easy of tracing the type's usage, write a comment about what service(s) uses the type. Like: `dependent services: onecore-<service>`
* A type might have other data sources than the ones in the onecore echo system, if so write a comment like: `external dependencies: <some_external_service>`
* 