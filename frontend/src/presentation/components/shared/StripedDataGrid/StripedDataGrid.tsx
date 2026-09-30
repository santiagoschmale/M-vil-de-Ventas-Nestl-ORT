import { GridCallbackDetails, GridColDef, GridFeatureMode, GridPaginationModel, GridRowIdGetter, GridValidRowModel } from "@mui/x-data-grid";
import { StripedDataGrid } from "./StripedDataGrid.style";

export type StripedGridOpts = {
  rowCount?: number | undefined;
  columns: GridColDef<GridValidRowModel, any, any>[]
  rows: GridValidRowModel[]
  loading?: boolean
  paginationMode?: GridFeatureMode
  paginationModel?: GridPaginationModel
  setPaginationModel?: ((model: GridPaginationModel, details: GridCallbackDetails<any>) => void)
  getRowId?: GridRowIdGetter<GridValidRowModel>
  rowHeight?: number
}

export default function StripedGrid(opts: StripedGridOpts) {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <StripedDataGrid
          loading={opts.loading}
          rows={opts.rows}
          rowHeight={opts.rowHeight}
          rowCount={opts.rowCount}
          columns={opts.columns}
          disableColumnFilter
          disableColumnSelector
          disableColumnMenu
          disableRowSelectionOnClick
          disableDensitySelector
          disableEval
          getRowId={opts.getRowId}
          paginationMode={opts.paginationMode}
          paginationModel={opts.paginationModel}
          onPaginationModelChange={opts.setPaginationModel}
          pageSizeOptions={[20]}
          initialState={{pagination: {
            paginationModel: {
              pageSize: 20,
              page: 0
            }
          }}}
          getRowClassName={(params) => params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd' }
        />
      </div>
    );
  }