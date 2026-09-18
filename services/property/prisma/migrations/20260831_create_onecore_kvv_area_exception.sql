-- Migration: create the KVV-area exception table for split properties.
-- A row means "this object (v1: this building) belongs to that KVV-area
-- instead of its property's default". See docs/superpowers/specs/
-- 2026-08-31-split-property-kvv-areas-design.md.
-- Run manually against each environment. Safe to re-run: guarded by
-- IF NOT EXISTS on sys.tables / sys.indexes.

BEGIN TRANSACTION;

BEGIN TRY

  IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_kvv_area_exception')
  BEGIN
    CREATE TABLE dbo.onecore_kvv_area_exception (
      object_type    NVARCHAR(30)     NOT NULL,
      code           NVARCHAR(30)     NOT NULL,
      kvv_area_id    UNIQUEIDENTIFIER NOT NULL,
      property_code  NVARCHAR(30)     NOT NULL,
      created_at     DATETIME         NOT NULL CONSTRAINT DF_onecore_kvv_area_exception_created_at DEFAULT GETDATE(),
      updated_at     DATETIME         NOT NULL CONSTRAINT DF_onecore_kvv_area_exception_updated_at DEFAULT GETDATE(),
      updated_by     NVARCHAR(255)    NULL,
      CONSTRAINT PK_onecore_kvv_area_exception PRIMARY KEY (object_type, code),
      CONSTRAINT FK_onecore_kvv_area_exception_kvv_area
        FOREIGN KEY (kvv_area_id) REFERENCES dbo.onecore_kvv_area (id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_onecore_kvv_area_exception_kvv_area_id' AND object_id = OBJECT_ID('dbo.onecore_kvv_area_exception'))
  BEGIN
    CREATE INDEX IX_onecore_kvv_area_exception_kvv_area_id ON dbo.onecore_kvv_area_exception (kvv_area_id);
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_onecore_kvv_area_exception_property_code' AND object_id = OBJECT_ID('dbo.onecore_kvv_area_exception'))
  BEGIN
    CREATE INDEX IX_onecore_kvv_area_exception_property_code ON dbo.onecore_kvv_area_exception (property_code);
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
