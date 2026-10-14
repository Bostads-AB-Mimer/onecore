-- Migration: add `subtypeId` to components, make `modelId` optional, widen `ncsCode`,
-- make the four purchase/warranty numerics nullable, one active installation per component.
-- See MIM-2082. Run manually against each environment.
-- Schema only. The components table must be EMPTY when this runs (MIM-2084 wipes and
-- re-imports), because `subtypeId` is added NOT NULL with no default. The script refuses
-- to run otherwise.
-- Safe to re-run: every change is guarded by IF (NOT) EXISTS on sys.columns, sys.indexes,
-- sys.foreign_keys. Statements that reference a column added in the same batch, and the
-- filtered index, go through sp_executesql. The filtered index needs QUOTED_IDENTIFIER ON,
-- which sqlcmd turns off by default, so it is set here.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;

BEGIN TRY

  -- 1. subtypeId NOT NULL, FK, index
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'subtypeId')
  BEGIN
    IF EXISTS (SELECT 1 FROM dbo.components)
      THROW 50000, 'dbo.components is not empty. Run the wipe from MIM-2084 before this migration.', 1;

    ALTER TABLE dbo.components
      ADD subtypeId UNIQUEIDENTIFIER NOT NULL;
  END

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_components_subtype')
  BEGIN
    EXEC sp_executesql N'
      ALTER TABLE dbo.components
        ADD CONSTRAINT FK_components_subtype FOREIGN KEY (subtypeId) REFERENCES dbo.component_subtypes(id);
    ';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.components') AND name = 'idx_components_subtype')
  BEGIN
    EXEC sp_executesql N'CREATE NONCLUSTERED INDEX idx_components_subtype ON dbo.components (subtypeId);';
  END

  -- 2. modelId nullable
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'modelId' AND is_nullable = 0)
    ALTER TABLE dbo.components ALTER COLUMN modelId UNIQUEIDENTIFIER NULL;

  -- 3. ncsCode NVARCHAR(15). max_length is bytes, so 15 chars = 30.
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'ncsCode' AND max_length < 30)
  BEGIN
    ALTER TABLE dbo.components ALTER COLUMN ncsCode NVARCHAR(15) NULL;
  END

  -- 4. Nullable numerics
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'warrantyMonths' AND is_nullable = 0)
    ALTER TABLE dbo.components ALTER COLUMN warrantyMonths INT NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'priceAtPurchase' AND is_nullable = 0)
    ALTER TABLE dbo.components ALTER COLUMN priceAtPurchase MONEY NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'depreciationPriceAtPurchase' AND is_nullable = 0)
    ALTER TABLE dbo.components ALTER COLUMN depreciationPriceAtPurchase MONEY NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.components') AND name = 'economicLifespan' AND is_nullable = 0)
    ALTER TABLE dbo.components ALTER COLUMN economicLifespan FLOAT NULL;

  -- 5. One active installation per component
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.component_installations') AND name = 'UX_component_installations_active')
  BEGIN
    EXEC sp_executesql N'
      CREATE UNIQUE NONCLUSTERED INDEX UX_component_installations_active
        ON dbo.component_installations (componentId)
        WHERE deinstallationDate IS NULL;
    ';
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

-- Rollback (run by hand if the migration must be undone; only valid while components is empty):
--   DROP INDEX UX_component_installations_active ON dbo.component_installations;
--   ALTER TABLE dbo.components ALTER COLUMN economicLifespan FLOAT NOT NULL;
--   ALTER TABLE dbo.components ALTER COLUMN depreciationPriceAtPurchase MONEY NOT NULL;
--   ALTER TABLE dbo.components ALTER COLUMN priceAtPurchase MONEY NOT NULL;
--   ALTER TABLE dbo.components ALTER COLUMN warrantyMonths INT NOT NULL;
--   ALTER TABLE dbo.components ALTER COLUMN ncsCode NVARCHAR(10) NULL;
--   DROP INDEX idx_components_model ON dbo.components;
--   ALTER TABLE dbo.components ALTER COLUMN modelId UNIQUEIDENTIFIER NOT NULL;
--   CREATE NONCLUSTERED INDEX idx_components_model ON dbo.components (modelId);
--   DROP INDEX idx_components_subtype ON dbo.components;
--   ALTER TABLE dbo.components DROP CONSTRAINT FK_components_subtype;
--   ALTER TABLE dbo.components DROP COLUMN subtypeId;
