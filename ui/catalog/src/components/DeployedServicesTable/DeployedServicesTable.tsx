import React, { useReducer, useEffect } from "react";
import { NoDataEmptyState } from "@carbon/ibm-products";
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Pagination,
  Button,
  Grid,
  Column,
  Checkbox,
  CheckboxGroup,
  ActionableNotification,
  Modal,
  TextInput,
  OverflowMenu,
} from "@carbon/react";
import {
  Export,
  Column as ColumnIcon,
  Deploy,
  Filter,
} from "@carbon/icons-react";
import styles from "./DeployedServices.module.scss";
import type { DeployedServicesRow } from "./types";
import { ACTION_TYPES, HEADERS, INITIAL_STATE, appReducer } from "./types";
import { CELL_RENDERERS } from "./CellRenderers";
import { downloadCSVWithChildren } from "@/utils/csv";
import type { Dispatch } from "react";
import type { AppAction } from "./types";

// Generic cell renderer wrapper
interface RenderCellProps {
  header: string;
  value: unknown;
  rowId: string;
  dispatch: Dispatch<AppAction>;
  cellKey: string;
  cellProps: Record<string, unknown>;
}

const renderCell = ({
  header,
  value,
  rowId,
  dispatch,
  cellKey,
  cellProps,
}: RenderCellProps) => {
  const CellRenderer = CELL_RENDERERS[header as keyof typeof CELL_RENDERERS];

  return (
    <TableCell key={cellKey} {...cellProps}>
      {CellRenderer ? (
        <CellRenderer value={value} rowId={rowId} dispatch={dispatch} />
      ) : (
        String(value || "")
      )}
    </TableCell>
  );
};

const DeployedServicesTable = () => {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  // Auto-dismiss success toast after 5 seconds
  useEffect(() => {
    if (state.exportToastOpen && state.exportToastKind === "success") {
      const timer = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.HIDE_EXPORT_TOAST });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [state.exportToastOpen, state.exportToastKind]);

  const handleDelete = async () => {
    if (!state.selectedRowId) {
      dispatch({
        type: ACTION_TYPES.SHOW_ERROR,
        payload: { message: "No service selected for deletion" },
      });
      return;
    }

    dispatch({ type: ACTION_TYPES.SET_IS_DELETING, payload: true });

    try {
      // Attempt server-side delete; if no backend exists this may fail.
      const res = await fetch(`/api/applications/${state.selectedRowId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const text = await res
          .text()
          .catch(() => res.statusText || "Delete failed");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      dispatch({ type: ACTION_TYPES.DELETE_ROW, payload: state.selectedRowId });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed deleting service deployment";
      const name =
        state.rowsData.find((r) => r.id === state.selectedRowId)?.name ?? "";
      dispatch({
        type: ACTION_TYPES.SHOW_ERROR,
        payload: { message: msg, rowName: name },
      });
    } finally {
      dispatch({ type: ACTION_TYPES.SET_IS_DELETING, payload: false });
      dispatch({ type: ACTION_TYPES.CLOSE_DELETE_DIALOG }); // still ok; the name is preserved
    }
  };

  const downloadCSV = async () => {
    const name = state.csvFileName.trim();

    // Validate filename before closing modal
    if (!name) {
      dispatch({
        type: ACTION_TYPES.SET_EXPORT_ERROR,
        payload: "Provide a valid file name",
      });
      return;
    }

    // Validate data before closing modal
    if (filteredRows.length === 0) {
      dispatch({
        type: ACTION_TYPES.SET_EXPORT_ERROR,
        payload: "No data available to export",
      });
      return;
    }

    // Close modal immediately
    dispatch({ type: ACTION_TYPES.CLOSE_EXPORT_DIALOG });

    // Use utility function to handle export
    const result = downloadCSVWithChildren(filteredRows, HEADERS, name);

    // Show toast based on result
    dispatch({
      type: ACTION_TYPES.SHOW_EXPORT_TOAST,
      payload: {
        message: result.message,
        kind: result.success ? "success" : "error",
      },
    });
  };

  const filteredRows = state.rowsData.filter((row) => {
    const matchesSearch = [
      row.name,
      row.status,
      row.uptime,
      row.messages,
      row.service,
    ]
      .join(" ")
      .toLowerCase()
      .includes(state.search.toLowerCase());

    const matchesServiceFilter =
      state.selectedServices.length === 0 ||
      state.selectedServices.includes(row.service);

    return matchesSearch && matchesServiceFilter;
  });

  const paginatedRows = filteredRows.slice(
    (state.page - 1) * state.pageSize,
    state.page * state.pageSize,
  );

  const noApplications = state.rowsData.length === 0;
  const noSearchResults =
    state.rowsData.length > 0 && filteredRows.length === 0;

  return (
    <>
      {state.toastOpen && (
        <ActionableNotification
          actionButtonLabel="Try again"
          aria-label="close notification"
          kind="error"
          closeOnEscape
          title={`Delete service deployment  ${state.deleteErrorRowName} failed`}
          subtitle={state.deleteErrorMessage}
          onCloseButtonClick={() => {
            dispatch({ type: ACTION_TYPES.HIDE_ERROR });
          }}
          onActionButtonClick={async () => {
            const currentRowId = state.selectedRowId;
            dispatch({ type: ACTION_TYPES.HIDE_ERROR });
            dispatch({
              type: ACTION_TYPES.SET_SELECTED_ROW_ID,
              payload: currentRowId,
            });
            await handleDelete();
          }}
          className={styles.customToast}
        />
      )}
      {state.exportToastOpen && (
        <ActionableNotification
          aria-label="close notification"
          kind={state.exportToastKind}
          closeOnEscape
          title={
            state.exportToastKind === "success"
              ? "Export successful"
              : "Export failed"
          }
          subtitle={state.exportToastMessage}
          onCloseButtonClick={() => {
            dispatch({ type: ACTION_TYPES.HIDE_EXPORT_TOAST });
          }}
          className={styles.customToast}
          hideCloseButton={false}
        />
      )}

      <div className={styles.tableContent}>
        <Grid fullWidth>
          <Column lg={16} md={8} sm={4} className={styles.tableColumn}>
            <DataTable
              rows={paginatedRows}
              headers={HEADERS.filter(
                (h) =>
                  h.key === "actions" ||
                  state.visibleColumns[
                    h.key as keyof typeof state.visibleColumns
                  ],
              )}
              size="lg"
            >
              {({
                rows,
                headers,
                getHeaderProps,
                getRowProps,
                getCellProps,
                getTableProps,
              }) => (
                <>
                  <TableContainer>
                    <TableToolbar>
                      <TableToolbarSearch
                        placeholder="Search"
                        persistent
                        value={state.search}
                        onChange={(e) => {
                          if (typeof e !== "string") {
                            dispatch({
                              type: ACTION_TYPES.SET_SEARCH,
                              payload: e.target.value,
                            });
                          }
                        }}
                      />

                      <TableToolbarContent>
                        <OverflowMenu
                          renderIcon={Filter}
                          iconDescription="Filter by service"
                          aria-label="Filter by service"
                          size="lg"
                          flipped
                        >
                          <li
                            className={styles.overflowMenuContent}
                            role="none"
                          >
                            <h6 className={styles.overflowMenuHeading}>
                              Filter by service
                            </h6>
                            <CheckboxGroup legendText="">
                              <Checkbox
                                labelText="Digitize documents"
                                id="filter-digitize"
                                checked={state.selectedServices.includes(
                                  "Digitize documents",
                                )}
                                onChange={() =>
                                  dispatch({
                                    type: ACTION_TYPES.TOGGLE_SERVICE_FILTER,
                                    payload: "Digitize documents",
                                  })
                                }
                              />
                              <Checkbox
                                labelText="Find similar item"
                                id="filter-similar"
                                checked={state.selectedServices.includes(
                                  "Find similar item",
                                )}
                                onChange={() =>
                                  dispatch({
                                    type: ACTION_TYPES.TOGGLE_SERVICE_FILTER,
                                    payload: "Find similar item",
                                  })
                                }
                              />
                              <Checkbox
                                labelText="Questions and answers"
                                id="filter-qa"
                                checked={state.selectedServices.includes(
                                  "Questions and answers",
                                )}
                                onChange={() =>
                                  dispatch({
                                    type: ACTION_TYPES.TOGGLE_SERVICE_FILTER,
                                    payload: "Questions and answers",
                                  })
                                }
                              />
                              <Checkbox
                                labelText="Summary"
                                id="filter-summary"
                                checked={state.selectedServices.includes(
                                  "Summary",
                                )}
                                onChange={() =>
                                  dispatch({
                                    type: ACTION_TYPES.TOGGLE_SERVICE_FILTER,
                                    payload: "Summary",
                                  })
                                }
                              />
                            </CheckboxGroup>
                            <div className={styles.overflowMenuActions}>
                              <Button
                                kind="secondary"
                                size="sm"
                                onClick={() =>
                                  dispatch({
                                    type: ACTION_TYPES.RESET_SERVICE_FILTER,
                                  })
                                }
                              >
                                Reset filter
                              </Button>
                            </div>
                          </li>
                        </OverflowMenu>
                        <Button
                          hasIconOnly
                          kind="ghost"
                          renderIcon={Export}
                          iconDescription="Export"
                          size="lg"
                          onClick={() =>
                            dispatch({
                              type: ACTION_TYPES.OPEN_EXPORT_DIALOG,
                            })
                          }
                        />
                        <OverflowMenu
                          renderIcon={ColumnIcon}
                          iconDescription="Edit columns"
                          aria-label="Edit columns"
                          size="lg"
                          flipped
                        >
                          <li
                            className={styles.overflowMenuContent}
                            role="none"
                          >
                            <h6 className={styles.overflowMenuHeading}>
                              Edit columns
                            </h6>
                            <CheckboxGroup legendText="">
                              {HEADERS.filter((h) => h.key !== "actions").map(
                                (header) => (
                                  <Checkbox
                                    key={`column-${header.key}`}
                                    labelText={String(header.header)}
                                    id={`column-${header.key}`}
                                    checked={
                                      state.visibleColumns[
                                        header.key as keyof typeof state.visibleColumns
                                      ]
                                    }
                                    disabled={header.key === "name"}
                                    onChange={() =>
                                      dispatch({
                                        type: ACTION_TYPES.TOGGLE_COLUMN_VISIBILITY,
                                        payload: header.key,
                                      })
                                    }
                                  />
                                ),
                              )}
                            </CheckboxGroup>
                            <div className={styles.overflowMenuActions}>
                              <Button
                                kind="secondary"
                                size="sm"
                                onClick={() =>
                                  dispatch({
                                    type: ACTION_TYPES.RESET_COLUMN_VISIBILITY,
                                  })
                                }
                              >
                                Reset
                              </Button>
                            </div>
                          </li>
                        </OverflowMenu>
                        <Button
                          kind="primary"
                          size="lg"
                          renderIcon={Deploy}
                          onClick={() => {
                            console.log("Deploy clicked");
                          }}
                        >
                          Deploy
                        </Button>
                      </TableToolbarContent>
                    </TableToolbar>

                    {noApplications ? (
                      <NoDataEmptyState
                        title="Start by adding a service"
                        subtitle="To deploy a new service, click Deploy."
                        className={styles.noDataContent}
                      />
                    ) : noSearchResults ? (
                      <NoDataEmptyState
                        title="No data"
                        subtitle="Try adjusting your search or filter."
                        className={styles.noDataContent}
                      />
                    ) : (
                      <Table {...getTableProps()}>
                        <TableHead>
                          <TableRow>
                            {headers.map((header) => {
                              const { key, ...rest } = getHeaderProps({
                                header,
                              });

                              return (
                                <TableHeader key={key} {...rest}>
                                  {header.header}
                                </TableHeader>
                              );
                            })}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => {
                            const { key: rowKey, ...rowProps } = getRowProps({
                              row,
                            });

                            return (
                              <React.Fragment key={rowKey}>
                                <TableRow
                                  {...rowProps}
                                  isExpanded={row.isExpanded}
                                >
                                  {row.cells.map((cell) => {
                                    const { key: cellKey, ...cellProps } =
                                      getCellProps({ cell });

                                    return renderCell({
                                      header: cell.info.header,
                                      value: cell.value,
                                      rowId: row.id as string,
                                      dispatch,
                                      cellKey,
                                      cellProps,
                                    });
                                  })}
                                </TableRow>
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </TableContainer>

                  {filteredRows.length > 20 && (
                    <Pagination
                      page={state.page}
                      pageSize={state.pageSize}
                      pageSizes={[5, 10, 20, 30]}
                      totalItems={filteredRows.length}
                      onChange={({ page, pageSize }) => {
                        dispatch({
                          type: ACTION_TYPES.SET_PAGE,
                          payload: page,
                        });
                        dispatch({
                          type: ACTION_TYPES.SET_PAGE_SIZE,
                          payload: pageSize,
                        });
                      }}
                    />
                  )}
                </>
              )}
            </DataTable>

            <Modal
              open={state.isDeleteDialogOpen}
              size="sm"
              modalLabel="Delete service deployment"
              modalHeading="Confirm delete"
              primaryButtonText="Delete"
              secondaryButtonText="Cancel"
              danger
              primaryButtonDisabled={!state.isConfirmed}
              onRequestClose={() => {
                dispatch({ type: ACTION_TYPES.CLOSE_DELETE_DIALOG });
              }}
              onRequestSubmit={handleDelete}
            >
              <p>
                Deleting an service deployment permanently deletes all
                associated components, including connected services, runtime
                metadata, and configurations will be permanently deleted, and it
                cannot be undone.
              </p>
              <div>
                <CheckboxGroup
                  className={styles.deleteConfirmation}
                  legendText="Confirm service deployment to be deleted"
                >
                  <Checkbox
                    id="checkbox-label-1"
                    labelText={
                      <strong>
                        {state.selectedRowId
                          ? state.rowsData.find(
                              (r: DeployedServicesRow) =>
                                r.id === state.selectedRowId,
                            )?.name
                          : ""}
                      </strong>
                    }
                    checked={state.isConfirmed}
                    onChange={(_, { checked }) =>
                      dispatch({
                        type: ACTION_TYPES.SET_CONFIRMED,
                        payload: checked,
                      })
                    }
                  />
                </CheckboxGroup>
              </div>
            </Modal>
            <Modal
              open={state.isExportDialogOpen}
              size="sm"
              modalHeading="Export as CSV"
              primaryButtonText="Export"
              secondaryButtonText="Cancel"
              onRequestSubmit={downloadCSV}
              onRequestClose={() =>
                dispatch({ type: ACTION_TYPES.CLOSE_EXPORT_DIALOG })
              }
            >
              <TextInput
                id="csv-file-name"
                labelText="File name"
                value={state.csvFileName}
                invalid={!!state.exportErrorMessage}
                invalidText={state.exportErrorMessage}
                onChange={(e) => {
                  dispatch({
                    type: ACTION_TYPES.SET_CSV_FILENAME,
                    payload: e.target.value,
                  });
                  dispatch({ type: ACTION_TYPES.CLEAR_EXPORT_ERROR });
                }}
              />
            </Modal>
          </Column>
        </Grid>
      </div>
    </>
  );
};

export default DeployedServicesTable;
