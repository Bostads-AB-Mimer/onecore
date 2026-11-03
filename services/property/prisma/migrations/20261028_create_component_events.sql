-- Migration: create component_events, one row per thing that happened to a component
-- (installed, repaired, replaced, inspected, ...).
-- See MIM-2065 / EPIC MIM-2064. Run manually against each environment.
-- Safe to re-run: every CREATE is guarded by IF NOT EXISTS on sys.tables / sys.indexes.
-- The filtered unique index goes through sp_executesql and needs QUOTED_IDENTIFIER ON,
-- which sqlcmd turns off by default, so it is set here.
-- related_component_id has no FK on purpose: SQL Server allows only one cascade path to
-- dbo.components, and NO ACTION would block deleting a replaced component.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;

BEGIN TRY

  IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'component_events')
  BEGIN
    CREATE TABLE dbo.component_events (
      id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_component_events_id DEFAULT NEWID(),
      component_id          UNIQUEIDENTIFIER NOT NULL,
      event_type            NVARCHAR(30)     NOT NULL,
      occurred_at           DATE             NOT NULL,
      source_type           NVARCHAR(20)     NOT NULL,
      source_id             NVARCHAR(100)    NULL,
      related_component_id  UNIQUEIDENTIFIER NULL,
      actor                 NVARCHAR(255)    NOT NULL,
      note                  NVARCHAR(MAX)    NULL,
      created_at            DATETIME         NOT NULL CONSTRAINT DF_component_events_created_at DEFAULT GETDATE(),
      CONSTRAINT PK_component_events PRIMARY KEY (id),
      CONSTRAINT FK_component_events_component
        FOREIGN KEY (component_id) REFERENCES dbo.components (id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT CK_component_events_event_type
        CHECK (event_type IN ('INSTALLED', 'DEINSTALLED', 'REPAIRED', 'REPLACED', 'NO_ACTION', 'INSPECTED')),
      CONSTRAINT CK_component_events_source_type
        CHECK (source_type IN ('WORK_ORDER', 'INSPECTION', 'MANUAL'))
    );
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.component_events') AND name = 'IX_component_events_component_id')
  BEGIN
    EXEC sp_executesql N'CREATE NONCLUSTERED INDEX IX_component_events_component_id ON dbo.component_events (component_id);';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.component_events') AND name = 'IX_component_events_source')
  BEGIN
    EXEC sp_executesql N'CREATE NONCLUSTERED INDEX IX_component_events_source ON dbo.component_events (source_type, source_id);';
  END

  -- Idempotency key: a retried POST from a work order or inspection finds the existing row.
  -- Rows without source_id (MANUAL) are never deduplicated.
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.component_events') AND name = 'UX_component_events_source_component_event')
  BEGIN
    EXEC sp_executesql N'
      CREATE UNIQUE NONCLUSTERED INDEX UX_component_events_source_component_event
        ON dbo.component_events (source_type, source_id, component_id, event_type)
        WHERE source_id IS NOT NULL;
    ';
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

-- Rollback (run by hand if the migration must be undone; deletes all component events):
--   DROP TABLE dbo.component_events;
