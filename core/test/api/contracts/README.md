
# Public Versioned API Contract Tests

These tests exist to ensure that externally published and versioned APIs 
do drift as the rest of the ONECore platform inevitably evolves.

**If you are about to "just fix a little something that broke here", 
stop and read this file first.**

How rigidly you should follow the content of this README is a function of actual usage.
If we know for a fact that no one uses a particular API and that no one is about to, 
then obviously `pragma > dogma`.

## What's being tested?

1. **Model transformation**

  - Model transformation between the *Internal ONECore Model* and the *API Response Model*

  - Tests use two sets of JSON fixtures:
    - `internal/` = input fixtures (may change as internal models evolve)
    - `v<n>/` = expected output fixtures (MUST NOT CHANGE for a given API version after it has been published)

2. **Route surface & schema**

  - The generated `openapi.json` schema for the versioned routes, which include:
    - uri paths
    - methods
    - params
    - response schemas
    - etc

## What if tests fail?

A failing contract test means one of two things:

- **Internal drift** (a k aPerfectly Valid and Expected):   
  Internal model changes require updating input fixtures or transform logic, but the *versioned output* must remain identical.

- **Breaking change** (Absolutely Do Not):   
  Someone(probably you) changed a versioned API shape/behavior that external consumers rely on.


### "Perfectly Valid and Expected" reasons for test failure and what to do about it

#### 1. The internal Contact model has changed
This means that the tests that verify that model transformation no longer accept the 
input they expect and need to be to be updated, but they *MUST STILL PRODUCE THE SAME RESULTS*

#### 2. We now produce an openapi.json with better metadata
That is fair as long as it's purely metadata and/or formatting, and we may simply update the test fixture file
that contain the canonical openapi.json for the API in question. 
But in doing so - triple-check that *nothing else* has changed.

#### 3. We fixed a bug that previously violated the contract!

If the API was already documented to behave a certain way, but the implementation was wrong, and you are fixing it
to match the existing contract, then:
- Fix the broken code
- Keep output fixtures unchanged
- If the fix changes observable output in any other way, see “Absolutely Do Not”.
- ...or otherwise use judgement, ask an adult and/or be pragmatic.

### "Absolutely Do Not" reasons for test failure and what to do about it

#### 1. We thought up a better way to represent the response and/or endpoint uris.
Great! But that requires a new version.

Do one more round of thinking on it to arrive at the "final version to end all versions", and then 
proceed to add the next version of the API in question. Don't forget to restore the version 
whose tests broke.

#### 2. “This field was undocumented / unused / always null”

Irrelevant.

If it appears in the OpenAPI spec or the canonical response fixture, then it is part of the contract 
and must not change. The consumer may have implemented their API client in a Ye-Olde-Heretek language/tech stack
and the omission of this field may cause things to blow up on their end. This is not what we do.

#### 3. I added a couple of new optional fields - surely that's not a big deal?

Still a breaking change.

Clients may do strict decoding, persist full responses, diff payloads.

Additive changes require a new version.
