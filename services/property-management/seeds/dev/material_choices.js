/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  await knex('MaterialChoice').del()
  await knex('MaterialChoice').insert([
    {
      MaterialChoiceId: '1',
      MaterialOptionId: '338C71FD-209A-430E-9EC7-A287FC414A49',
      ApartmentId: '102-008-03-0202/07',
      RoomType: 'KOKHALL',
      Status: 'Submitted',
      DateOfSubmission: new Date(),
      DateOfCancellation: null,
    },
  ]);
};
