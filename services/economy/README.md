# Introduction

Microservice for economy in ONECore.

## Installation

We use pnpm as our package manager: https://pnpm.io/installation

1. Fill out values in src/common/config.ts
2. Use required version of node `nvm use`
3. Install packages: `pnpm install`

## Development

Start the development server: `pnpm run dev`

## Env

According to .env.template.

---

## Debt Collection

### Process

Each day, one or more CSV files are created on the Xledger SFTP server.
These files can currently contain 3 things:

- Expired rent invoices
- Expired miscellaneous invoices
- Balance corrections

A cronjob runs the `src/scripts/import-debt-collection.ts` script every day.
The script downloads any new files from the Xledger SFTP server, processes them, and uploads the results to the Sergel Inkasso (Mimers current debt collection partner) SFTP server in the format that they require.

### Local testing

There are 3 endpoints in the debt collection service that can be used to test the processing of each type of file.
The endpoints accept a CSV file of varying format (specified below) and return what would be sent to Sergel Inkasso if that CSV file was processed by the `import-debt-collection` script.

- `/debt-collection/rent-cases`
  Handles rent invoices.
  Input format:

  ```
  Kundnr;Fakturanr;Fakturadatum;Förfallodatum;Fakturabelopp;Kvarstående belopp;Kommentar
  P123456;552611002422232;2026-09-16;2026-09-30;2993.0000;2993.0000;
  P112233;552611002422224;2026-09-16;2026-09-30;2426.0000;2426.0000;
  P445566;552611002422216;2026-09-01;2026-09-09;3665.0000;3665.0000;
  ```

- `/debt-collection/random-invoices`
  Handles miscellaneous invoices.
  Input format:

  ```
  Kundnr;Fakturanr;Fakturadatum;F�rfallodatum;Fakturabelopp;Kvarst�ende belopp;Kommentar
  P123456;552611002422232;2026-09-11;2026-09-30;2030.0000;2030.0000;510-006-02-0201/04: Flexning
  P112233;552611002422224;2026-09-11;2026-09-30;2842.0000;2842.0000;807-005-03-0301/07: Handhavande vitvaror
  P445566;552611002422216;2026-03-10;2026-04-09;254.0000;54.0000;807-033-03-0201/02: Förbrukning el, vatten, värme
  ```

- `/debt-collection/balance-corrections`
  Handles balance corrections.
  Input format:
  ```
  Kundnr;Typ;Fakturanr;Datum;Belopp;Kvarstående_belopp
  P123456;Kredit;13318;2026-05-22 00:00:00;2030.0000;0.0000
  P112233;Betalning;552611002422232;2026-05-22 00:00:00;100.0000;2883.0000
  P445566;Betalning;552611002422224;2026-05-22 00:00:00;2400.0000;26.0000
  ```

Example curl command:

```bash
curl -X POST 'http://localhost:5080/debt-collection/rent-cases' \
  --header 'Accept: */*' \
  --form-string 'csv=Kundnr;Fakturanr;Fakturadatum;Förfallodatum;Fakturabelopp;Kvarstående belopp;Kommentar
  P123456;552611002422232;2026-09-16;2026-09-30;2993.0000;2993.0000;
  P112233;552611002422224;2026-09-16;2026-09-30;2426.0000;2426.0000;
  P445566;552611002422216;2026-09-01;2026-09-09;3665.0000;3665.0000;'
```
