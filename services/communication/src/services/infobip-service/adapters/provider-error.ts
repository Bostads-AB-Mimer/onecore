// Thrown when the provider answered with a non-2xx status: a definite
// refusal, as opposed to a timeout or dropped connection where the outcome
// is unknown. The scheduled-sends worker retries the former next tick and
// lets the claim expire for the latter.
export class ProviderResponseError extends Error {
  constructor(
    public readonly provider: 'infobip-sms' | 'infobip-email',
    public readonly status: number,
    body: string
  ) {
    super(
      provider === 'infobip-sms'
        ? `Infobip SMS API error: ${status} - ${body}`
        : `Infobip Email API error: ${status} - ${body}`
    )
    this.name = 'ProviderResponseError'
  }
}
