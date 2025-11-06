# DAX Platform Documentation

## Table of Contents
- [DAX Concepts](#dax-concepts)
- [DAX Connectivity](#dax-connectivity)
- [Technical Use Cases](#technical-use-cases)
- [Alliera Concepts](#alliera-concepts)
- [Security Overview](#security-overview)
- [DAX REST API](#dax-rest-api)
- [DAX REST API SDK](#dax-rest-api-sdk)
- [Signing of HTTP Messages](#signing-of-http-messages)
- [OpenAPI Specification](#openapi-specification)

---

## DAX Concepts

### Partner
A Partner is a legal entity in the DAX sphere and in order to become a partner you need to have an agreement with Amido AB. As a partner you might be a single user, a business or a part of an Alliera instance.

All parties might have different ways of accessing the platform depending on their level of integration. For example, an Alliera instance can connect to the streaming interface of the platform while a business user might only be able to connect through the REST API.

### Instance
An Instance in DAX is an interacting client that either responds to requests coming through the DAX platform, requests information or demands other partners and instances to perform certain operations. An Instance is assigned to either your Alliera installation (most common) or to your own internal integration point.

### Contract
A contract is a term of agreement between two parties, in DAX's case between two partners. The contract specifies the benefits that one partner (the promisee) gets within the other party's domain (the promisor). This is not to be confused with any actual contract between the partners and/or Amido. A contract is a one-way list of benefits and regulations. 

If two parties need to gain access to both each other's domains, two separate contracts need to be in place. For example, Partner A can have access to Partner B's access groups but without a separate contract Partner B cannot access Partner A's access groups. A separate contract is needed for that.

### Contract Clause
A clause determines what action you can take, what information you can access/request along with limitations posed on these operations in regards to frequency and size.

### Contract Offer
A contract offer is a proposal from a potential partner (promisee) to a second partner (promisor) containing the details and scope of a contract. Basically it is a not-yet-signed contract which the promisor needs to sign and acknowledge before it takes effect. Contract offers can have an automatic expiry and conditional cancelability.

---

## DAX Connectivity

To be able to talk to DAX you need to be able to reach the platform using one or both of the REST based API and the deep service cluster integration.

The REST based API provides a simple stateless query and request integration while the Service Cluster integration makes it possible for realtime communication between client and the platform.

If you are connecting to DAX through an Alliera installation you need to be able to reach DAX using both REST and Deep integration.

### DNS Lookups
The client needs to be able to do DNS lookups to find the DAX servers.

### REST API
Most clients will need to access the DAX REST API which can be reached using HTTPS:

```
https://api-prod.dax.amido.io
```

### Deep Integration
Clients like Alliera with a deeper integration also connect to our DAX Service Clusters through TCP port 4001. Communication must be possible to all of these endpoints:

```
nats://nats1-prod.dax.amido.io:4001
nats://nats2-prod.dax.amido.io:4001
nats://nats3-prod.dax.amido.io:4001
```

### Firewall Configuration
In order for an Alliera instance to connect to the DAX platform the Alliera server needs to be able to reach the above two endpoint categories. There is no need to open any ports from outside your organization to the Alliera server.

#### Outgoing Connections

| Protocol | Port | Endpoints | Description |
|----------|------|-----------|-------------|
| UDP | 53 | The host's DNS server | DNS lookups |
| TCP | 443 | api-prod.dax.amido.io | Ordinary HTTPS connections |
| TCP | 4001 | nats1.prod.dax.aws.amido.io<br>nats2.prod.dax.aws.amido.io<br>nats3.prod.dax.aws.amido.io | Service cluster connections |

---

## Technical Use Cases

### Obtaining Temporary Access by GPS Coordinate

In a case where you as an integrator need temporary access to a number of access groups/doors based on a GPS coordinate you can use an API endpoint called `ObtainAccessByGps`. As of right now this is only available through Deep Integration.

Let's say you have a GPS coordinate where something happens. Within a provided radius there are a number of access groups or doors published that you would want to have access to; either because you don't know exactly which door you need access to or in a case where the public is in jeopardy and need multiple accesses in a surrounding area at the same time.

All Alliera instances with published access groups within this radius and whom you also have a contract with will respond to this request and give access to the cards you provide.

#### Flow Sequence

1. You as an integrating partner issue an `ObtainAccessByGps` request providing a set of coordinates, a radius and an identifier you wish to associate with this request. You also provide information about for how long you need access.
2. DAX will ask an external resource or another Alliera about what cards need access.
3. DAX determines what access groups/doors are available and what other Allieras are responsible for those groups.
4. DAX sends individual requests to these Allieras providing information about what access groups need access, what cards to create, for how long they should be valid and an identifier.
5. All Allieras verify and process this request to the best of their ability reporting back to DAX about success or failure.
6. DAX assembles the responses and returns the response to you.

### Withdrawing Temporary Access

Even though you've provided a maximum lifetime for how long you need access in the ObtainAccess flow above you can also cancel your access immediately by issuing a `WithdrawAccess` request providing the identifier from the original ObtainAccess request.

#### Flow Sequence

1. You issue a `WithdrawAccess` request providing the identifier you used when obtaining access.
2. DAX determines who was affected by the original request.
3. DAX sends individual requests to each Alliera asking it to withdraw all access associated with the original identifier.
4. All Allieras verify and process this request and reports the results back to DAX.
5. DAX assembles the responses and returns the response to you.

---

## Alliera Concepts

In Alliera there are certain entities that you need to know about to be able to use DAX efficiently.

### CardOwner

A card owner is, as the name says, a holder of cards. In Alliera a CardOwner is an entity that has certain properties set which defines its validity and what it is allowed to do within the system.

A card owner, as the name implies, also is the owner/user of an access card and can be divided into two different entities: person and apartment. An apartment is very much like a person but has certain settings with relation to booking and entry phones.

A person is also a card owner but doesn't necessarily need to be an actual person. In many cases this person could be an entity holding access cards in terms of "lended" cards. In other cases a person might also be a whole company even if we strive to make a card owner as close to one single user as possible to determine explicit responsibility if the cardowner's card is being used or to cancel a user's card because it was lost.

If a card owner doesn't match up with a single physical person it will have negative implications in regards to administration and responsibility like above.

### Cards

The concept of an access card can mean a lot of things. It could be an actual physical card or a key fob; all using different technologies but it could also be a mobile phone or part of a system with just email addresses and electronic lock barrels. In most cases the convention card means a physical key or key fob.

A card owner can have a maximum of 50 cards in Alliera even if that should be kept as low as possible. Usually it should be kept at a level where the card owner easily can remember the number of cards he or she has. If the card owner is an apartment there is usually more access cards (3-5).

Cards can be disabled or archived. A disabled card is usually a temporary action where the card is temporarily lost or can't be located. Archiving a card is a more permanent action where the card has been lost, destroyed or never again will be used. When a card is disabled or archived it will (in most cases) immediately cease to work and all access grants will be revoked.

A card can also have a start and stop time indicating during which period it will work. Outside of the start and stop times the card will lose all its grants.

### Pin Codes

A card can have a PIN code to increase security. PIN codes can be set individually on any card but can also be set to a cardowner and affect all his or her cards. The PIN code can be used together with a card by the access control system to grant you access through a door, disable alarms etc.

In some systems a PIN code can also be used instead of an access card, also known as a group code.

### Access Groups

An access group is a combination of doors and schedules. In most cases an access group is a grouping of doors all connected to a physical location, function and schedule. In some access control systems this could also be connected to specific functions like disabling alarms, etc.

In essence an access group is an entity determining what parts of an access control system are to be controlled, how they can be controlled and the schedule. Most of this is determined by the underlying access control system.

### Access Grants

An access grant is the process of granting access to an access group. An access group can preferably be granted directly to a card owner or in special circumstances to one of the card owner's issued cards.

In Alliera an access grant can have a start and a stop time meaning the access grant can be granted and revoked at a predetermined time. It can also be open ended to have an undetermined stop time. In addition a grant can also at any time be revoked or archived in order to deny access. Some of these concepts behave differently in some access control systems.

### Folders

Folders are a tree-like structure with folders and subfolders. These folders can have access control lists to determine what operations an Alliera operator can execute along with what information the operator can see. CardOwners and AccessGroups are always located within this tree.

### Organizations

An organization is a "tag" that can be used to show what organization and department a person and apartment is connected to.

### Logs

Information about logs.

---

## Security Overview

All parties communicating through DAX need an Amido/DAX issued certificate to be able to talk and interact with the platform. This is true for both REST API calls and service bus connections. In both these cases transport is encrypted using TLS and all messages are cryptographically signed.

To retrieve a certificate from Amido/DAX a relationship must be formed in the term of a legal binding contract between the 3rd party and Amido. Upon signing this contract a certificate may be issued.

### Getting a Certificate

#### Key Pair Generation

All parties need to create their own RSA private/public key pair. The private key must be stored in a safe manner and is the responsibility of the party to keep secret and safe. DAX and Amido normally has no knowledge of this key; it's strictly private.

In case of Alliera all Alliera installations has its own private/public key pair generated upon installation and is stored in Alliera's database using Microsoft strong encryption connected to the user account running Alliera. If the account password running Alliera is lost the key can never be recovered but needs to be regenerated. As stated above Amido normally has no record of this key and we will never ask for it.

#### Example Key Generation

By using the software openssl it's possible to create your own private/public key pair.

```bash
openssl genrsa -out private.pem 2048
```

**Note!** If you're using openssl version 3 or later you need to add a traditional flag like below:

```bash
openssl genrsa -traditional -out private.pem 2048
```

This will generate a 2048 bit RSA private key and store it in a file called private.pem. It's a simple text file and it will look something like this:

```
-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAwSlVS+zEyiIzthzyUCRyKiceRWf+dKp6Fd/GTxuBOnimXwuc
bF+KFR8lSC5kXH5arxImRVJG6JT85NY2hxcGex0ZrHmVAQHSljywFoYFlhCdJiQr
H2c5flAHubkgWni8QNwhWomQlpLpNwjQFGYUYn+FVM......
...
-----END RSA PRIVATE KEY-----
```

To extract your public key from your private key you need to run the following command:

```bash
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```

The output will be your public key and just as the private key it is a simple text file that looks like this:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwSlVS+zEyiIzthzyUCRy
KiceRWf+dKp6Fd/GTxuBOnimXwucbF+KFR8lSC5kXH5arxImRVJG6JT85NY2hxcG
ex0ZrHmVAQHSljywFoYFlhCdJiQrH2c5flAHubkgWni8QNwhWomQlpLpNwjQFGYU
...
-----END PUBLIC KEY-----
```

### Certificate Signing Request

To get a certificate from Amido/DAX a Certificate Signing Request needs to be created and signed with the private key. The CSR is then sent to Amido for review and if it fulfills all technical and contractual obligations set, a DAX certificate will be issued. This certificate is stored within DAX for future validation of all signed messages.

The issued certificate can be revoked by Amido at any time or upon request by the owning party if the key has been deemed compromised.

If the private key is lost, all communication with DAX will cease since DAX will not accept unsigned messages. The process of generating a new key pair, CSR and certificate must be restarted.

#### Example CSR Generation

In order to create a CSR you need access to your private key as described above.

Copy the below content to the file `request.conf` and update the values above the line with your provided values before saving.

```ini
# Your Partner ID as provided by Amido.
PARTNERID=8bd953d6-52ee-4c8e-a953-217abd16fbd1

# Your Instance ID as provided by Amido.
INSTANCEID=a2ff6de6-2ec6-4677-9913-942bfc1cd588

# Your country in two letter code.
COUNTRY=SE

# Your city or company location.
LOCALIZATION=Gothenburg

# Your partner name/organization that you've configured or that was provided by Amido.
PARTNERNAME=Partner Name

# The name of the part of your partner's organization that will own the certificate.
SECTION=IS/IT

# -----------------------------------------------
# --- No modifications needed below this line ---
# -----------------------------------------------

[ dn ]
C = $COUNTRY
L = $LOCALIZATION
O = $PARTNERNAME
OU = $SECTION
CN = $INSTANCEID.instance.prod.dax.amido.io

[ req ]
distinguished_name = dn
req_extensions = req_ext
prompt = no

[ req_ext ]
subjectAltName = DNS:$INSTANCEID.instance.prod.dax.amido.io,DNS:$PARTNERID.partner.prod.dax.amido.io
```

With this configuration file you can create a valid CSR with the following command:

```bash
openssl req -new -config request.conf -key private.pem -out request.csr
```

A certificate signing request has now been created in PEM format in the file `request.csr`. You can check the content of the request by issuing:

```bash
openssl req -text -noout -verify -in request.csr
```

It will look something like this:

```
verify OK
Certificate Request:
    Data:
        Version: 1 (0x0)
        Subject: C = SE, L = Gothenburg, O = Partner Name, OU = IS/IT, CN = a2ff6de6-2ec6-4677-9913-942bfc1cd588.instance.prod.dax.amido.io
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                RSA Public-Key: (2048 bit)
...
        Requested Extensions:
            X509v3 Subject Alternative Name:
                DNS:a2ff6de6-2ec6-4677-9913-942bfc1cd588.instance.prod.dax.amido.io, DNS:8bd953d6-52ee-4c8e-a953-217abd16fbd1.partner.prod.dax.amido.io
```

If you check the actual content of the `request.csr` file it looks like this:

```
-----BEGIN CERTIFICATE REQUEST-----
MIIDBTCCAe0CAQAwfTELMAkGA1UEBhMCU0UxEzARBgNVBAcMCkdvdGhlbmJ1cmcx
FzAVBgNVBAoMDjxQQVJUTkVSIE5BTUU+MQ4wDAYDVQQLDAVJUy1JVDEwMC4GA1UE
...
dKLpGhQTJS575bXscg3BiKUQvPAjWKZPcBD6HKJ96Aqf0VxxYKxYuvlTRN+Bw4Qg
De3DpfmILRuQw/Z+/iaz2HNQaz3LWwFC4H85fGbg2MmQ/JyzfnPYXqJ+ltNN85St
TfXuZPwURQqQ
-----END CERTIFICATE REQUEST-----
```

The contents of this file need to be provided to Amido Customer Success in order to get your certificate.

### Usage

The private key is used to cryptographically sign all messages sent through the DAX platform. DAX will not accept a message that has not been signed and it will not accept a message that it can't cryptographically verify through its own certificate store connected to the partner and instance sending the message.

All messages are also time stamped before signing to prohibit and detect replay attempts.

One might think that since all communication between a party and DAX is encrypted using SSL/TLS this is unnecessary but by signing the message we can prove and keep a record of who actually sent the message and we can verify and prove that it's the original message sent and that it has not been tampered with or modified in any way, not even by ourselves.

### REST API

The REST API is protected by a username and password. The username and password is used to request a security token from DAX which for a short time can be used in subsequent requests before it expires.

Together with this token the party's private key must be used to sign the request. Signing the requests makes it possible for DAX to verify who the sender is and that the message has not been tampered with before processing.

### Alliera-to-Alliera

In an Alliera-to-Alliera scenario there are three parties involved:

- Sending Alliera
- DAX
- Receiving Alliera

All three parties has their own set of private/public keys in order to sign and verify messages going through the DAX platform.

An Alliera will never, ever, talk directly to any other entity but DAX. It's not possible for anyone to circumvent DAX since a receiving Alliera will never accept a message not signed by DAX.

If the sending Alliera wants to send a message to the receiving Alliera this is the series of events taking place:

1. The sending Alliera creates a message that it wants to send. It knows about the receiving Alliera just as a "remote entity" which it cannot communicate directly with but it needs to send the message through DAX.
2. The sending Alliera signs the message and asks DAX to send it to the remote Alliera.
3. DAX receives the message, verifies its origin in terms of cryptographically checking the signature. If the signature is valid it sends the message on for processing.
4. The process handling the message checks DAX internal contracts to check that the sending Alliera and receiving Alliera are allowed to talk to each other. If not, the message is discarded immediately.
5. DAX further checks the operation of the message. Is it a query for information or a command to perform an action? All queries, commands and requests need to be specifically allowed by the receiving Alliera and all these operations are determined by the contract and its clauses. If no explicit clause is found that allows the operation, the message will be discarded. Also there might be limits in the contract determining the extent possible by the request/command.
6. The message has been deemed correct and the contract is valid. DAX now repackages the message, signs it with DAX private key and sends it to the receiving Alliera.
7. A permanent record, event, is created with the technical content of the request being handled. This event is recorded and kept by DAX.
8. The receiving Alliera verifies the message and performs the operation requested.
9. If the operation requires some kind of response, the response is created, signed and sent back to DAX from the receiving Alliera.
10. DAX verifies the signature of the receiving Alliera's response and discards the message if the signature fails verification.
11. Another permanent record, event, is created with the technical contents of this response. This event is also recorded and kept by DAX.
12. DAX repackages the response into a response back to the sending Alliera. The response is signed by DAX.
13. The sending Alliera verifies the signature in the message from DAX, pairs it with its own requests and returns the response coming from the receiving Alliera.

Through this chain a correlation ID is created which links all of this data together. In essence a record is kept of the complete transaction from request to response and can be called up for review if needed.

### 3rd Party-to-Alliera

If a 3rd party using the REST API wants to communicate with an Alliera, DAX follows the exact same order of events as described above. The request is verified in the same way and recorded in the same way.

### Alliera Access Control

All operations performed by a 3rd party and/or other Alliera needs to be verified as described above. But also, the resources such as access groups, card owners and cards within Alliera that a remote party actually gains access to is determined by the Alliera owning the information. By default no information is available but must explicitly be given access by the operators of Alliera. This further limits any kind of data a remote party can gain access to beside the checks DAX does with regards to contracts and clauses.

---

## DAX REST API

This API makes it possible to handle entities such as but not limited to card owners, cards and grants. To be able to use this API a contract between partners is needed.

### Authentication

Authentication uses the OAuth 2 scheme with username, password, client id and password flow grant type.

A token can be requested by issuing a POST request to the token endpoint located at `https://api-prod.dax.amido.io/oauth/token` with the OAuth 2 parameters either as form body (recommended) or as a query string.

```
username=<USERNAME>&password=<PASSWORD>&client_id=<INSTANCE ID>&grant_type=password
```

In the response your token and its validity will be presented as a JSON response:

```json
{
  "access_token": "eyJhb.....",
  "token_type": "bearer",
  "expires_in": 900
}
```

The `access_token` must be presented in an authorization request header for all subsequent requests:

```
Authorization: Bearer eyJhb......
```

### HTTP Request Signing

If using the V2 versions of the API (recommended) you need to create a private/public key pair and provide Amido with your public key before you can consume the API. The instructions for the actual calls can be found in the [Signing of HTTP Messages](#signing-of-http-messages) section.

### Schema

All API access is over HTTPS and accessed from `https://api-prod.dax.amido.io/`. All data is sent and received as JSON.

All timestamps are returned in ISO 8601 format and the internal timestamps in DAX is UTC based whereas Alliera timestamps will be local time of Alliera instance.

```
YYYY-MM-DDTHH:MM:SSZ
```

### Patching

#### Card Owners

| Path | Allowed Operations | Description |
|------|-------------------|-------------|
| /FAMILYNAME | REPLACE | Change family name |
| /SPECIFICNAME | REPLACE | Change specific name |
| /PINCODE | REPLACE | Change pin code |
| /ORGANIZATIONID | REPLACE | Change organization |
| /FOLDERID | REPLACE | Change organizer folder |
| /COMMENT | REPLACE | Change comment |
| /STARTTIME | REPLACE | Change start time validity |
| /STOPTIME | REPLACE | Change stop time validity |
| /DISABLED | REPLACE | Change disabled state. Disable the cardowner by setting this to true and Enable cardowner by setting it to false |
| /ARCHIVED | REPLACE | Change archived state. Archive the cardowner by setting this to true and restore cardowner by setting it to false |

#### Grants

| Path | Allowed Operations | Description |
|------|-------------------|-------------|
| /DISABLED | REPLACE | Change disabled state |
| /STARTTIME | REPLACE | Change start time |
| /STOPTIME | REPLACE | Change stop time |

#### Cards

| Path | Allowed Operations | Description |
|------|-------------------|-------------|
| /NAME | REPLACE | Rename card |
| /CLASSIFICATION | REPLACE | Change card classification |
| /PINCODE | REPLACE | Change pin code |
| /STARTTIME | REPLACE | Change start time validity of Card Owner |
| /STOPTIME | REPLACE | Change stop time validity of Card Owner |
| /DISABLED | REPLACE | Change disabled state of Card Owner |
| /ARCHIVED | REPLACE | Change archived state. Archive the card by setting this to true and restore card by setting it to false |

#### Folders

| Path | Allowed Operations | Description |
|------|-------------------|-------------|
| /NAME | REPLACE | Rename organizer folder |
| /PARENTFOLDERID | REPLACE | Change parent folder |
| /DESCRIPTION | REPLACE | Change description |

#### Organizations

| Path | Allowed Operations | Description |
|------|-------------------|-------------|
| /NAME | REPLACE | Rename organization |
| /FOLDERID | REPLACE | Change organizer folder |
| /COMMENT | REPLACE | Change comment |

### Versioning

New versions of the API may be published any time. In order to target a version all API endpoints have a version part. Available versions will be presented in the response header `api-supported-versions`.

Current version is 2.0 and its endpoint is `https://api-prod.dax.amido.io/v2.0/` and requires signed HTTP Requests.

### HTTP Redirects

DAX WebAPI might use HTTP redirection when deemed appropriate. Clients should assume that any request may result in a redirection. Receiving an HTTP redirection is not an error and clients should follow the redirect.

| Status Code | Description |
|-------------|-------------|
| 301 | Moved Permanently. This and all future requests should be directed to the given URI. |
| 302, 307 | Temporary redirection. In this case, the request should be repeated with another URI; however, future requests should still use the original URI. In contrast to how 302 was historically implemented, the request method is not allowed to be changed when reissuing the original request. For example, a POST request should be repeated using another POST request. |

Redirection status codes not listed above may be used but will adhere to the HTTP 1.1 specification.

### Pagination

Some operations have pagination support and all these operations can handle two query parameters for pagination:

| Parameter | Datatype | Default | Description |
|-----------|----------|---------|-------------|
| offset | int | 0 | Offset from which the response will be filtered |
| limit | int | 50 | Maximum number of items to return in request |

#### Example Usage

This will get a list of resources starting with offset 100 and limiting the response to the next 25 resources:

```bash
curl 'https://<api-endpoint>/resources?offset=100&limit=25'
```

#### Paging Information in Response

All operations supporting paging will include paging information in the response:

| Parameter | Datatype | Description |
|-----------|----------|-------------|
| totalCount | int | Number of items in total found |
| offset | int | The offset used when handling the request |
| limit | int | The number of items used when handling the request |

If the `totalCount` says -1 the API doesn't know the total amount of items. If `totalCount` says 0 it means that no items were found (hence result should be empty).

#### Example Pagination Response

```json
{
  "apiVersion": "1.0",
  "correlationId": "7d0e6cac-d7da-4980-96c8-92c7a106ec88",
  "statusCode": 200,
  "message": null,
  "paging": {
    "totalCount": -1,
    "offset": 100,
    "limit": 25
  },
  "data": { ... }
}
```

### Context

With each request it's possible to add a request context. The request context will be part of the response headers; the value will just be copied and returned. The purpose of the request context is to make it easier for decoupled systems to pair a request with its response.

The context can be set to anything but is limited to 255 characters.

The Context parameter must be passed in the body of the request even if it's a GET request:

```json
{
  "Context": "Requesting context"
}
```

### Rate Limiting

For API requests using OAuth the number of requests you can make is limited. Your current limitation is presented in the API responses:

```
X-Rate-Limit-Limit: 7d
X-Rate-Limit-Remaining: 9998
X-Rate-Limit-Reset: 2020-03-04T07:46:24.6607163Z
```

See response headers below for more information.

### Request Headers

| Header | Description |
|--------|-------------|
| Content-Type | The Content-Type for all requests must be set to `application/json`. Failure to do so will result in a 400 Bad Request error. |

### Response Headers

| Header | Description |
|--------|-------------|
| X-Dax-Context | Mirror of the context parameter available in all requests |
| X-Dax-Response-Time-ms | Response time for the internal processing of the request |
| X-Correlation-Id | A GUID that is unique to all processing done by this request. In order for Amido to debug any problems this Id is crucial |
| X-Rate-Limit-Reset | UTC timestamp for when the next reset of rate limitation window will be made |
| X-Rate-Limit-Remaining | The number of requests still available in the current limitation window |
| X-Rate-Limit-Limit | The limitation window for which the current rate limitations apply |
| api-supported-versions | The available REST API versions available |
| X-Dax-CertificateThumbprint | Thumbprint of the verified certificate |
| X-Dax-CertificateExpiresAtUtc | Expiration date of the certificate |

---

## DAX REST API SDK

The DAX REST API SDK is a .NET Standard 2.0 class library created to give any integrating party a head start in their development process.

It contains a WebClient which takes care of all tiresome signature calculations and basic setups needed to consume the API.

An example implementation can be found in our example repo at GitHub:

[https://github.com/AmidoAB/dax.net](https://github.com/AmidoAB/dax.net)

### Installation

You can find the basic NuGet package for the DAX REST API, `AmidoAB.Dax.WebClient`, at nuget.org. More information here:

[https://www.nuget.org/packages/AmidoAB.Dax.WebClient](https://www.nuget.org/packages/AmidoAB.Dax.WebClient)

### Dependencies

Except for some basic .NET Core dependencies there are two interfaces needed to be fulfilled in order to use the SDK:

- `Microsoft.Extensions.Logging.ILogger`
- `Microsoft.Extensions.DependencyInjection.IHttpClientFactory`

#### ILogger

The `ILogger` is used to output debug and logging information from the DaxWebClient application. There are integrations with Microsoft's logging infrastructure as well as Serilog, log4net or whatever logging framework you're using. If you have no interest in the logging output any void logger implementing the interface can be injected.

#### IHttpClientFactory

A factory abstraction for a component that can create `HttpClient` instances with custom configuration for a given logical name.

This client is used for all calls to the DAX REST API.

The most simple HTTP Client Factory implementation for testing purposes where client name is ignored can look something like this:

```csharp
public class HttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new HttpClient();
}
```

### Getting Started with Configuration

Once the SDK has been added to your project you need to configure up the DaxWebClientInstance. There is a helper class to help you build the configuration using a fluent interface.

#### Building the Configuration

First start by instantiating a new `DaxWebClientConfigurationBuilder`:

```csharp
var config = new DaxWebClientConfigurationBuilder();
```

This will generate a base configuration but with some parts missing. To use the API you at least need the following statements:

```csharp
.WithApiUrl("https://api-prod.dax.amido.io")
.WithCredentials("<your provided username>", "<your provided password>")
.WithInstanceId(Guid.Parse("<your provided instance id>"))
.WithPrivateKey("<your RSA private key in PEM format>")
```

After this all you have to do is to Build the configuration:

```csharp
.Build();
```

The complete code block looks like this:

```csharp
var config = new DaxWebClientConfigurationBuilder()
    .WithApiUrl("https://api-prod.dax.amido.io")
    .WithCredentials("username", "password")
    .WithInstanceId(Guid.Parse("E0A6DC41-FF76-4D79-AC09-545465208EF2"))
    .WithPrivateKey("<privateKeyInPemFormat>")
    .Build();
```

#### Create and Initialize the Client

When the configuration has been built you're ready to create the client and initialize it:

```csharp
var client = new DaxWebClient(<your ILogger instance>, <your IHttpClientFactory instance>);

client.Initialize(config);
```

Now the client is ready and set up. The client automatically will take care of a few things for you:

- It will build the signature string of the outgoing request and taking into account the parameters needed
- It will hold your access token and check for expiry
- If the token is missing or has expired it will request a new one before the actual outgoing call. This will delay all outgoing requests until the new token has been received

### Your First Request

When the client has been initialized and the configuration validated it's time to make your first request. If you've read the DAX internals you know there's a contract required between your and other partner's within DAX so let's get a list of your current contracts.

#### Building the Request

Start by creating a new instance of the `DaxWebRequestBuilder`. It takes two types as type parameters, your request type and your response type. These need to match in order to get the correct result:

```csharp
var request = new DaxWebRequestBuilder<GetContractsRequest, GetContractsResponse>();
```

After that you can create your actual request, in this case the `GetContractsRequest`. All Requests take a mandatory resource identifier which you need to create in order to target certain other partners and instances. More on that later. In this case it's easy because the resource identifier is basically just an empty object:

```csharp
.AddRequest(new GetContractsRequest(new ContractsResourceIdentifier()))
```

There is a limit to the number of contracts you will receive in one request so there is an added fluent extension you can use to add paging information to your request. In this case we will only request the first 10 contracts available for us by adding:

```csharp
.AddPaging(0, 10)
```

After that the request just needs to be built:

```csharp
var request = new DaxWebRequestBuilder<GetContractsRequest, GetContractsResponse>()
    .AddRequest(new GetContractsRequest(new ContractsResourceIdentifier()))
    .AddPaging(0, 10)
    .Build();
```

#### Sending the Request

You now have a client and a request. In order to send the request you just need to tell the client to do a call:

```csharp
var response = client.Call(request);
```

... or asynchronously ...

```csharp
var response = await client.CallAsync(request);
```

The response will be a standardized `DaxWebClientResponse` which contains the actual deserialized response together with other data regarding the response.

That's it!

### Request Builder

The request builder has some other extension methods that could be useful:

| Method | Parameters | Description |
|--------|------------|-------------|
| AddQueryParameter | string name, string value | Adds a query parameter to the outgoing request |
| AddRequestHeader | string name, string value | Adds a custom request header to the outgoing request |
| AddPaging | int offset, int limit | Adds paging data to the request |
| SetTimeout | int timeout | Sets the request timeout in milliseconds |
| SetContext | string context | Sets the request context |

---

## Signing of HTTP Messages

### Abstract

When communicating with version 2 and later of DAX REST API using the HTTP protocol you will need to sign all requests with a private key. DAX has the public key on record and will verify the signature with the caller's public key.

### Signature

All transactions with DAX are considered high security and having an additional signature in the HTTP header allows the server to ensure that even if the transport channel has been compromised the content of the message from a client has not been compromised and/or tampered with.

### Components of the Signature (Signature Parameters)

There are a number of different parameters of the signature header that are needed - here we will detail those parameters. The order of the parameters are not important.

A complete signature header can look like this:

```
realm="dax" algorithm="sha256withrsa" headers="(request-target) cache-control date content-length" signature="zYLDJ9pBayO5QpFkYo1b1r5h0j9sK/Sy8lzAwz2hTdwQy..."
```

#### realm

**REQUIRED.** The realm parameter signals the server which realm is being used. A realm is used to group together a set of users, credentials and roles. In DAX the realm to use is `dax`.

Example:
```
realm="dax"
```

#### signature

**REQUIRED.** This is the base 64 encoded signature generated by the client. The client uses the algorithm and headers signature parameters to form a signing string and this string is later signed with the private key associated with the calling client using the specified algorithm. The signature parameter is then set to the base 64 encoding of the signature.

Example:
```
signature="zYLDJ9pBayO5QpFkYo1b1r5h0j9sK/Sy8lzAwz2hTdwQyXj6ZrjgCAdc..."
```

#### headers

**REQUIRED.** The headers parameter is used to specify the ordered list of HTTP headers that has been used when generating the signature. The headers should be lowercased with surround quotes and if multiple headers are used they should be separated by a single space character. If there are duplicate headers the last header will be used.

Mandatory headers when communicating with DAX are `date` and the special `(request-target)` (more on that later).

If a header is in the list but not available in the request, the request will be denied.

Example:
```
headers="(request-target) date content-type"
```

#### algorithm

**REQUIRED.** The algorithm parameter is used to specify the digital signature algorithm that was used when generating the signature. DAX supports a single algorithm, sha256 hashed and signed with RSA, SHA256withRSA.

Example:
```
algorithm="sha256withrsa"
```

### Signature String Construction

In order to generate the string that is signed with a key, the client MUST use the values of each HTTP header field in the headers signature parameter, in the order they appear in the headers signature parameter. It's also important to note that the enforced encoding is utf-8 and that information needs to be included either as a Content-Type header or as an Accept-Charset header. And of course, all necessary strings must be calculated and hashed using utf-8.

The special `(request-target)` header is used to specify the HTTP request's target. To put it together you use the lowercased request method (i.e. get, post, put, delete etc.), a single space character and then the request's target path. Lowercasing is only used for the request method and not the target path.

Create the headers field by joining the lowercased header field name followed by a colon (`:`), a single space and the header field value. Always trim the value before adding it. If there are multiple instances of the header being used it should be concatenated to the previous header separated with a single comma (`,`).

All values in the string should end with a newline `\n` character.

### Example GET Request

```http
GET /api/v2/DaxEndPoint HTTP/1.1
Host: dax.amido.se
Date: 2020-05-17T14:44:30+02:00
X-Example: Example header
           with some whitespace.
Cache-Control: max-age=60
Cache-Control: must-revalidate
```

The following example illustrates how the signature would be constructed if the headers part of the signature looked like this:

```
headers="(request-target) host date cache-control"
```

Example signing string:

```
(request-target): get /api/v2/DaxEndPoint\n
host: dax.amido.se\n
date: 2020-05-17T14:44:30+02:00\n
cache-control: max-age=60,must-revalidate\n
```

### Example POST Request

When DAX gets a request with a body the body MUST be included in the signing string.

```http
POST /api/v2/DaxEndPoint HTTP/1.1
Host: dax.amido.se
Date: 2020-05-17T14:44:30+02:00
X-Example: Example header
           with some whitespace.
Cache-Control: max-age=60
Cache-Control: must-revalidate
Content-Length: 18

{"hello": "world"}
```

The following example illustrates how the signature would be constructed if the headers part of the signature looked like this:

```
headers="(request-target) host date cache-control content-length"
```

Example signing string:

```
(request-target): post /api/v2/DaxEndPoint\n
host: dax.amido.se\n
date: 2020-05-17T14:44:30+02:00\n
cache-control: max-age=60,must-revalidate\n
content-length: 18\n
{"hello": "world"}
```

### DAX Mandatory Headers

The following headers are mandatory to use when calling DAX:

- `(request-target)`
- `date` (as an ISO-8601 timestamp with timezone information, see examples above)

### Creating the Actual Signature

In order to create a signature, a client must use the contents of the HTTP message, the headers value, and the signature string construction algorithm to create the signature string.

The algorithm must then be used to generate a digital signature on the signature string.

The signature is then generated by base 64 encoding the output of the digital signature algorithm. For example, assume that the algorithm value was SHA256withRSA. This would signal to the server that the data has been signed with an RSA Private Key and that the signature string hashing function is SHA-256. The signature should be a byte[] which is then base 64 encoded and placed in the signature value.

Complete request example with signature:

```http
GET /api/v2/DaxEndPoint HTTP/1.1
Host: dax.amido.se
Signature: realm="dax" algorithm="sha256withrsa" headers="(request-target) cache-control date" signature="zYLDJ9pBayO5QpFkYo1b1r5h0j9sK/Sy8lzAwz2hTdwQy..."
Date: 2020-05-17T14:44:30+02:00
X-Example: Example header
           with some whitespace.
Cache-Control: max-age=60
Cache-Control: must-revalidate
```

The signature string using algorithm sha256withrsa could conceptually be described as:

```
base64encode(rsasign(sha256(byte-array-from-utf8(signingstring))))
```

### Final Words

If you're using .NET Core we have a .NET Standard SDK available upon request that takes care of all complexities during REST API requests. The code for this SDK will be published at a later date.

---

## OpenAPI Specification

The complete OpenAPI specification for the DAX REST API can be found at:

**[OpenAPI Specification Placeholder - Link to be provided]**

This specification includes detailed information about:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Error codes and responses
- Example requests and responses

---

## Additional Resources

- GitHub Repository: [https://github.com/AmidoAB/dax.net](https://github.com/AmidoAB/dax.net)
- NuGet Package: [https://www.nuget.org/packages/AmidoAB.Dax.WebClient](https://www.nuget.org/packages/AmidoAB.Dax.WebClient)
- Support: Contact Amido Customer Success

---

*This documentation is maintained by Amido AB. For questions or support, please contact your Amido representative.*