/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE dispatch (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        direction VARCHAR(10) NOT NULL DEFAULT 'outbound'
          CONSTRAINT ck_dispatch_direction CHECK (direction IN ('outbound','inbound')),
        channel VARCHAR(10) NOT NULL
          CONSTRAINT ck_dispatch_channel CHECK (channel IN ('sms','email')),
        fromAddress NVARCHAR(255) NOT NULL,
        subject NVARCHAR(500) NULL,
        body NVARCHAR(MAX) NOT NULL,
        messageType VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        triggeredByUser NVARCHAR(255) NULL,
        triggeredAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        recipientCount INT NOT NULL DEFAULT 0,
        audienceCriteria NVARCHAR(MAX) NULL,
        inReplyToDispatchId UNIQUEIDENTIFIER NULL,
        templateId UNIQUEIDENTIFIER NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_dispatch_in_reply_to
          FOREIGN KEY (inReplyToDispatchId) REFERENCES dispatch(id),
        CONSTRAINT fk_dispatch_template
          FOREIGN KEY (templateId) REFERENCES template(id)
      );

      CREATE INDEX idx_dispatch_triggeredAt ON dispatch(triggeredAt DESC);
      CREATE INDEX idx_dispatch_triggeredByUser_triggeredAt
        ON dispatch(triggeredByUser, triggeredAt DESC);
      CREATE INDEX idx_dispatch_messageType_triggeredAt
        ON dispatch(messageType, triggeredAt DESC);

      CREATE TABLE message_recipient (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        dispatchId UNIQUEIDENTIFIER NOT NULL,
        kundId NVARCHAR(50) NULL,
        toAddress NVARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL
          CONSTRAINT ck_message_recipient_status
          CHECK (status IN ('pending','sent','delivered','failed','bounced','received')),
        statusUpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        externalMessageId NVARCHAR(100) NULL,
        error NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_message_recipient_dispatch
          FOREIGN KEY (dispatchId) REFERENCES dispatch(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_message_recipient_kundId_dispatchId
        ON message_recipient(kundId, dispatchId);
      CREATE INDEX idx_message_recipient_dispatchId
        ON message_recipient(dispatchId);
      CREATE INDEX idx_message_recipient_externalMessageId
        ON message_recipient(externalMessageId);

      CREATE TABLE dispatch_attachment (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        dispatchId UNIQUEIDENTIFIER NOT NULL,
        storageKey NVARCHAR(500) NOT NULL,
        filename NVARCHAR(255) NOT NULL,
        contentType VARCHAR(100) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_dispatch_attachment_dispatch
          FOREIGN KEY (dispatchId) REFERENCES dispatch(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_dispatch_attachment_dispatchId
        ON dispatch_attachment(dispatchId);
    `)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      DROP TABLE IF EXISTS dispatch_attachment;
      DROP TABLE IF EXISTS message_recipient;
      DROP TABLE IF EXISTS dispatch;
    `)
  })
}
