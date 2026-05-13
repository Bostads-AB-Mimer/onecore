-- Rollback for 20260512_create_onecore_management_area_tables.sql.
-- Drops the OneCore-owned management area tables in reverse FK order.
-- Run manually against each environment. Safe to re-run: every DROP is guarded by IF EXISTS.

BEGIN TRANSACTION;

BEGIN TRY

  IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_property_kvv_area')
  BEGIN
    DROP TABLE dbo.onecore_property_kvv_area;
  END

  IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_kvv_area')
  BEGIN
    DROP TABLE dbo.onecore_kvv_area;
  END

  IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'onecore_cost_center')
  BEGIN
    DROP TABLE dbo.onecore_cost_center;
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
