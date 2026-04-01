"use client"

import { forwardRef, useState } from "react"
import { TableIcon, PlusCircleIcon, Trash2Icon, ChevronDownIcon } from "lucide-react"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTable } from "./use-table"
import type { Editor } from "@tiptap/react"

export interface TableButtonProps extends Omit<ButtonProps, "type"> {
  editor?: Editor | null
}

/**
 * Dropdown button for table operations in TipTap editor.
 * When no table is active, shows "Insert Table".
 * When inside a table, shows a dropdown with table management options.
 */
export const TableButton = forwardRef<HTMLButtonElement, TableButtonProps>(
  ({ editor: providedEditor, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [open, setOpen] = useState(false)

    const {
      isTableActive,
      canInsertTable,
      insertTable,
      deleteTable,
      addColumnBefore,
      addColumnAfter,
      deleteColumn,
      addRowBefore,
      addRowAfter,
      deleteRow,
      toggleHeaderRow,
      mergeCells,
      splitCell,
    } = useTable({ editor })

    if (!editor) return null

    // Not inside a table — show simple insert button
    if (!isTableActive) {
      return (
        <Button
          type="button"
          data-style="ghost"
          role="button"
          disabled={!canInsertTable}
          data-disabled={!canInsertTable}
          tabIndex={-1}
          aria-label="Insert table"
          tooltip="Insert Table"
          onClick={insertTable}
          {...buttonProps}
          ref={ref}
        >
          <TableIcon className="tiptap-button-icon" />
          <span className="tiptap-button-text">Table</span>
        </Button>
      )
    }

    // Inside a table — show dropdown with options
    return (
      <div className="table-button-wrapper" style={{ position: "relative", display: "inline-block" }}>
        <Button
          type="button"
          data-style="ghost"
          data-active-state="on"
          role="button"
          tabIndex={-1}
          aria-label="Table options"
          tooltip="Table Options"
          onClick={() => setOpen((prev) => !prev)}
          {...buttonProps}
          ref={ref}
        >
          <TableIcon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-icon" style={{ width: 12, height: 12 }} />
        </Button>

        {open && (
          <>
            {/* Backdrop to close */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 49,
              }}
              onClick={() => setOpen(false)}
            />
            <div
              className="table-dropdown-menu"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                zIndex: 50,
                minWidth: 200,
                background: "var(--tt-surface-bg, #fff)",
                border: "1px solid var(--tt-gray-light-a-200, #e2e8f0)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: "4px 0",
              }}
            >
              {[
                { label: "Add column before", action: addColumnBefore },
                { label: "Add column after", action: addColumnAfter },
                { label: "Delete column", action: deleteColumn, danger: true },
                null, // divider
                { label: "Add row before", action: addRowBefore },
                { label: "Add row after", action: addRowAfter },
                { label: "Delete row", action: deleteRow, danger: true },
                null,
                { label: "Toggle header row", action: toggleHeaderRow },
                { label: "Merge cells", action: mergeCells },
                { label: "Split cell", action: splitCell },
                null,
                { label: "Delete table", action: deleteTable, danger: true, icon: <Trash2Icon style={{ width: 14, height: 14 }} /> },
              ].map((item, i) => {
                if (item === null) {
                  return (
                    <div
                      key={`divider-${i}`}
                      style={{
                        height: 1,
                        background: "var(--tt-gray-light-a-200, #e2e8f0)",
                        margin: "4px 0",
                      }}
                    />
                  )
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action()
                      setOpen(false)
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 12px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: item.danger ? "var(--tt-red-600, #dc2626)" : "inherit",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--tt-gray-light-a-50, #f8fafc)"
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "none"
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }
)

TableButton.displayName = "TableButton"
