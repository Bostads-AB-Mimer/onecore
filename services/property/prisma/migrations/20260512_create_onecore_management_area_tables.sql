-- Migration: create OneCore-owned tables for management areas (förvaltningsområden).
-- See MIM-1775 / EPIC MIM-1774. Run manually against each environment.
-- Safe to re-run: every CREATE is guarded by IF NOT EXISTS on sys.tables / sys.indexes.

BEGIN TRANSACTION;

BEGIN TRY

  IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_cost_center')
  BEGIN
    CREATE TABLE dbo.onecore_cost_center (
      id                       UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_onecore_cost_center_id DEFAULT NEWID(),
      code                     NVARCHAR(30)     NOT NULL,
      name                     NVARCHAR(255)    NOT NULL,
      lead_keycloak_user_id    NVARCHAR(255)    NULL,
      deputy_keycloak_user_id  NVARCHAR(255)    NULL,
      created_at               DATETIME         NOT NULL CONSTRAINT DF_onecore_cost_center_created_at DEFAULT GETDATE(),
      updated_at               DATETIME         NOT NULL CONSTRAINT DF_onecore_cost_center_updated_at DEFAULT GETDATE(),
      updated_by               NVARCHAR(255)    NULL,
      CONSTRAINT PK_onecore_cost_center PRIMARY KEY (id),
      CONSTRAINT UQ_onecore_cost_center_code UNIQUE (code)
    );
  END

  IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_kvv_area')
  BEGIN
    CREATE TABLE dbo.onecore_kvv_area (
      id                            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_onecore_kvv_area_id DEFAULT NEWID(),
      code                          NVARCHAR(30)     NOT NULL,
      name                          NVARCHAR(255)    NULL,
      cost_center_id                UNIQUEIDENTIFIER NOT NULL,
      responsible_keycloak_user_id  NVARCHAR(255)    NULL,
      created_at                    DATETIME         NOT NULL CONSTRAINT DF_onecore_kvv_area_created_at DEFAULT GETDATE(),
      updated_at                    DATETIME         NOT NULL CONSTRAINT DF_onecore_kvv_area_updated_at DEFAULT GETDATE(),
      updated_by                    NVARCHAR(255)    NULL,
      CONSTRAINT PK_onecore_kvv_area PRIMARY KEY (id),
      CONSTRAINT UQ_onecore_kvv_area_code UNIQUE (code),
      CONSTRAINT FK_onecore_kvv_area_cost_center
        FOREIGN KEY (cost_center_id) REFERENCES dbo.onecore_cost_center (id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_onecore_kvv_area_cost_center_id' AND object_id = OBJECT_ID('dbo.onecore_kvv_area'))
  BEGIN
    CREATE INDEX IX_onecore_kvv_area_cost_center_id ON dbo.onecore_kvv_area (cost_center_id);
  END

  IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_property_kvv_area')
  BEGIN
    CREATE TABLE dbo.onecore_property_kvv_area (
      property_code  NVARCHAR(30)     NOT NULL,
      kvv_area_id    UNIQUEIDENTIFIER NOT NULL,
      created_at     DATETIME         NOT NULL CONSTRAINT DF_onecore_property_kvv_area_created_at DEFAULT GETDATE(),
      updated_at     DATETIME         NOT NULL CONSTRAINT DF_onecore_property_kvv_area_updated_at DEFAULT GETDATE(),
      updated_by     NVARCHAR(255)    NULL,
      CONSTRAINT PK_onecore_property_kvv_area PRIMARY KEY (property_code),
      CONSTRAINT FK_onecore_property_kvv_area_kvv_area
        FOREIGN KEY (kvv_area_id) REFERENCES dbo.onecore_kvv_area (id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_onecore_property_kvv_area_kvv_area_id' AND object_id = OBJECT_ID('dbo.onecore_property_kvv_area'))
  BEGIN
    CREATE INDEX IX_onecore_property_kvv_area_kvv_area_id ON dbo.onecore_property_kvv_area (kvv_area_id);
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
