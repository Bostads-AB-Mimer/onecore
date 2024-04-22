import * as React from 'react';
import {DataGrid} from '@mui/x-data-grid';
import type {GridColDef} from '@mui/x-data-grid';

const DataGridTable = ({
                       rows,
                       columns,
                       getRowId,
                   }: {
    rows: any[],
    columns: GridColDef[],
    getRowId: any

}) => {
    return (
        <DataGrid
            rows={rows}
            columns={columns}
            getRowId={getRowId}
            disableRowSelectionOnClick
            hideFooter
            autoHeight
        />
    );
}
export default DataGridTable