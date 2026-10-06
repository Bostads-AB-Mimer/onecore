-- Migration: add `type` to component_categories and `code` to component_types.
-- See MIM-2103. Run manually against each environment.
-- Safe to re-run: every change is guarded by IF NOT EXISTS on sys.columns / sys.check_constraints.
-- The UPDATEs run through sp_executesql because they reference columns added in the same batch.

BEGIN TRANSACTION;

BEGIN TRY

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.component_categories') AND name = 'type')
  BEGIN
    ALTER TABLE dbo.component_categories
      ADD [type] NVARCHAR(20) NOT NULL CONSTRAINT DF_component_categories_type DEFAULT 'EQUIPMENT';
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
  EXEC sp_executesql N'
    UPDATE dbo.component_categories
    SET [type] = ''SURFACE''
    WHERE categoryName = N''Ytskikt'';

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

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

-- Rollback (run by hand if the migration must be undone):
--   ALTER TABLE dbo.component_types DROP CONSTRAINT CK_component_types_code;
--   ALTER TABLE dbo.component_types DROP COLUMN code;
--   ALTER TABLE dbo.component_categories DROP CONSTRAINT CK_component_categories_type;
--   ALTER TABLE dbo.component_categories DROP CONSTRAINT DF_component_categories_type;
--   ALTER TABLE dbo.component_categories DROP COLUMN [type];
