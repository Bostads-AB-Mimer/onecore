-- Migration: add `type` to component_categories and `code` to component_types.
-- See MIM-2103. Run manually against each environment.
-- Schema only: existing rows keep type = 'EQUIPMENT' and code = NULL, and are
-- set from the admin UI afterwards.
-- Safe to re-run: every change is guarded by IF NOT EXISTS.
-- The CHECK constraints and the index run through sp_executesql because they
-- reference columns added in the same batch, which SQL Server otherwise
-- rejects at compile time. The filtered index needs QUOTED_IDENTIFIER ON,
-- which sqlcmd turns off by default, so it is set here.
-- Verified to run twice on fresh tables with sqlcmd.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;

BEGIN TRY

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.component_categories') AND name = 'type')
  BEGIN
    ALTER TABLE dbo.component_categories
      ADD [type] NVARCHAR(20) NOT NULL CONSTRAINT DF_component_categories_type DEFAULT 'EQUIPMENT';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_component_categories_type')
  BEGIN
    EXEC sp_executesql N'
      ALTER TABLE dbo.component_categories
        ADD CONSTRAINT CK_component_categories_type CHECK ([type] IN (''EQUIPMENT'', ''SURFACE''));
    ';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.component_types') AND name = 'code')
  BEGIN
    ALTER TABLE dbo.component_types
      ADD code NVARCHAR(20) NULL;
  END

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_component_types_code')
  BEGIN
    EXEC sp_executesql N'
      ALTER TABLE dbo.component_types
        ADD CONSTRAINT CK_component_types_code CHECK (code IS NULL OR code IN (''WALL'', ''FLOOR'', ''CEILING''));
    ';
  END

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
