/**
 * Step-by-step user guides ("Guider"). A guide belongs to a category and
 * holds ordered steps; each step holds ordered images whose bytes live in
 * file-storage (MinIO) under `storageKey`. Old slugs are kept in
 * guide_slug_history so links keep working after a rename.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE guide_category (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(100) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE UNIQUE INDEX uq_guide_category_name ON guide_category(name);

      CREATE TABLE guide (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        slug NVARCHAR(200) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(1000) NOT NULL DEFAULT '',
        categoryId UNIQUEIDENTIFIER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CONSTRAINT ck_guide_status CHECK (status IN ('draft','published')),
        publishedAt DATETIME2 NULL,
        createdBy NVARCHAR(200) NOT NULL,
        updatedBy NVARCHAR(200) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_guide_category
          FOREIGN KEY (categoryId) REFERENCES guide_category(id)
      );

      CREATE UNIQUE INDEX uq_guide_slug ON guide(slug);
      CREATE INDEX idx_guide_categoryId ON guide(categoryId);
      CREATE INDEX idx_guide_status ON guide(status);

      CREATE TABLE guide_slug_history (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        guideId UNIQUEIDENTIFIER NOT NULL,
        slug NVARCHAR(200) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_guide_slug_history_guide
          FOREIGN KEY (guideId) REFERENCES guide(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX uq_guide_slug_history_slug ON guide_slug_history(slug);
      CREATE INDEX idx_guide_slug_history_guideId ON guide_slug_history(guideId);

      -- Step ids are supplied by the client so a save can upsert by id.
      -- sortOrder is normalised to 0..n-1 by the adapter on every write.
      CREATE TABLE guide_step (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        guideId UNIQUEIDENTIFIER NOT NULL,
        sortOrder INT NOT NULL,
        title NVARCHAR(200) NOT NULL,
        body NVARCHAR(MAX) NOT NULL DEFAULT '',
        calloutType VARCHAR(20) NULL
          CONSTRAINT ck_guide_step_calloutType
          CHECK (calloutType IN ('tip','note','warning')),
        calloutText NVARCHAR(2000) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_guide_step_guide
          FOREIGN KEY (guideId) REFERENCES guide(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_guide_step_guideId ON guide_step(guideId);

      CREATE TABLE guide_step_image (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        stepId UNIQUEIDENTIFIER NOT NULL,
        sortOrder INT NOT NULL,
        storageKey NVARCHAR(500) NOT NULL,
        filename NVARCHAR(255) NOT NULL,
        contentType VARCHAR(100) NOT NULL,
        altText NVARCHAR(500) NOT NULL DEFAULT '',
        caption NVARCHAR(500) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_guide_step_image_step
          FOREIGN KEY (stepId) REFERENCES guide_step(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX uq_guide_step_image_storageKey ON guide_step_image(storageKey);
      CREATE INDEX idx_guide_step_image_stepId ON guide_step_image(stepId);
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
      DROP TABLE IF EXISTS guide_step_image;
      DROP TABLE IF EXISTS guide_step;
      DROP TABLE IF EXISTS guide_slug_history;
      DROP TABLE IF EXISTS guide;
      DROP TABLE IF EXISTS guide_category;
    `)
  })
}
