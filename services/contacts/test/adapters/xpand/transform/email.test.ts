import { transformEmailAddress } from '@src/adapters/xpand/transform/email'

describe('transformEmailAddress', () => {
  it.each([
    {
      dbRow: {
        emailId: '_1S60ZNMCA     ',
        emailType: 'mail           ',
        ownerObjectKey: '_0J41591U4     ',
        emailAddress: 'ola@korv.dummy.se                                     ',
        isPrimaryEmail: 1,
      },
      expected: {
        emailAddress: 'ola@korv.dummy.se',
        type: 'unspecified',
        isPrimary: true,
      },
    },
  ])('should transform $dbRow to $expected', ({ dbRow, expected }) => {
    expect(transformEmailAddress(dbRow)).toEqual(expected)
  })
})
