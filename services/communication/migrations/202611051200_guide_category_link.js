/**
 * A guide may belong to several categories and subcategories. The single
 * guide.categoryId column is replaced by the link table guide_category_link;
 * every existing guide keeps its category as its one link.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE guide_category_link (
        guideId UNIQUEIDENTIFIER NOT NULL,
        categoryId UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT pk_guide_category_link PRIMARY KEY (guideId, categoryId),
        CONSTRAINT fk_guide_category_link_guide
          FOREIGN KEY (guideId) REFERENCES guide(id) ON DELETE CASCADE,
        CONSTRAINT fk_guide_category_link_category
          FOREIGN KEY (categoryId) REFERENCES guide_category(id)
      );

      CREATE INDEX idx_guide_category_link_categoryId
        ON guide_category_link(categoryId);
    `)
    await trx.raw(`
      INSERT INTO guide_category_link (guideId, categoryId)
      SELECT id, categoryId FROM guide;
    `)
    await trx.raw(`
      DROP INDEX idx_guide_categoryId ON guide;
      ALTER TABLE guide DROP CONSTRAINT fk_guide_category;
      ALTER TABLE guide DROP COLUMN categoryId;
    `)
  })
}

/**
 * Restores guide.categoryId from the links. A guide keeps only one of its
 * categories (the top-level category with the first name, before its
 * subcategories); its other links are lost.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE guide ADD categoryId UNIQUEIDENTIFIER NULL;
    `)
    await trx.raw(`
      UPDATE g SET categoryId = (
        SELECT TOP 1 l.categoryId
        FROM guide_category_link l
        JOIN guide_category c ON c.id = l.categoryId
        LEFT JOIN guide_category p ON p.id = c.parentId
        WHERE l.guideId = g.id
        ORDER BY COALESCE(p.name, c.name),
          CASE WHEN c.parentId IS NULL THEN 0 ELSE 1 END,
          c.name
      )
      FROM guide g;
    `)
    await trx.raw(`
      ALTER TABLE guide ALTER COLUMN categoryId UNIQUEIDENTIFIER NOT NULL;
      ALTER TABLE guide ADD CONSTRAINT fk_guide_category
        FOREIGN KEY (categoryId) REFERENCES guide_category(id);
      CREATE INDEX idx_guide_categoryId ON guide(categoryId);
      DROP TABLE guide_category_link;
    `)
  })
}
