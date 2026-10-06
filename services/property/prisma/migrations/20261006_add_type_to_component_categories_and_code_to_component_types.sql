-- Migration: add `type` to component_categories and `code` to component_types.
-- See MIM-2103. Run manually against each environment.
-- Safe to re-run: schema changes are guarded by IF NOT EXISTS, and the one-time
-- seed of category types only runs in the batch that adds the `type` column.
-- The seed and the index run through sp_executesql because they reference
-- columns added in the same batch.
-- The unique index is created after the seed, so if two SURFACE categories
-- both hold a type named Vägg/Golv/Tak the whole migration rolls back and the
-- duplicate must be resolved by hand before re-running.

BEGIN TRANSACTION;

BEGIN TRY

  DECLARE @typeAdded BIT = 0;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.component_categories') AND name = 'type')
  BEGIN
    ALTER TABLE dbo.component_categories
      ADD [type] NVARCHAR(20) NOT NULL CONSTRAINT DF_component_categories_type DEFAULT 'EQUIPMENT';
    SET @typeAdded = 1;
  END

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_component_categories_type')
  BEGIN
    ALTER TABLE dbo.component_categories
      ADD CONSTRAINT CK_component_categories_type CHECK ([type] IN ('EQUIPMENT', 'SURFACE'));
  END

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.component_types') AND name = 'code')
  BEGIN
    ALTER TABLE dbo.component_types
      ADD code NVARCHAR(20) NULL;
  END

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_component_types_code')
  BEGIN
    ALTER TABLE dbo.component_types
      ADD CONSTRAINT CK_component_types_code CHECK (code IS NULL OR code IN ('WALL', 'FLOOR', 'CEILING'));
  END

  -- One-time seed from the names the code used to compare against.
  IF @typeAdded = 1
  BEGIN
    EXEC sp_executesql N'
      UPDATE dbo.component_categories
      SET [type] = ''SURFACE''
      WHERE categoryName = N''Ytskikt'';
    ';
  END

  EXEC sp_executesql N'
    UPDATE t
    SET t.code = CASE t.typeName
      WHEN N''Vägg'' THEN ''WALL''
      WHEN N''Golv'' THEN ''FLOOR''
      WHEN N''Tak''  THEN ''CEILING''
    END
    FROM dbo.component_types t
    JOIN dbo.component_categories c ON c.id = t.categoryId
    WHERE c.[type] = ''SURFACE''
      AND t.typeName IN (N''Vägg'', N''Golv'', N''Tak'')
      AND t.code IS NULL;
  ';

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.component_types') AND name = 'UX_component_types_code')
  BEGIN
    EXEC sp_executesql N'
      CREATE UNIQUE NONCLUSTERED INDEX UX_component_types_code
        ON dbo.component_types (code)
        WHERE code IS NOT NULL;
    ';
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

-- Rollback (run by hand if the migration must be undone):
--   DROP INDEX UX_component_types_code ON dbo.component_types;
--   ALTER TABLE dbo.component_types DROP CONSTRAINT CK_component_types_code;
--   ALTER TABLE dbo.component_types DROP COLUMN code;
--   ALTER TABLE dbo.component_categories DROP CONSTRAINT CK_component_categories_type;
--   ALTER TABLE dbo.component_categories DROP CONSTRAINT DF_component_categories_type;
--   ALTER TABLE dbo.component_categories DROP COLUMN [type];
