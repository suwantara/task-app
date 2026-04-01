"use client"

import { useCallback } from "react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { Editor } from "@tiptap/react"

export interface UseTableConfig {
  editor?: Editor | null
}

export function useTable({ editor: providedEditor }: UseTableConfig = {}) {
  const { editor } = useTiptapEditor(providedEditor)

  const isTableActive = editor?.isActive("table") ?? false
  const canInsertTable = editor?.can().insertTable() ?? false

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const deleteTable = useCallback(() => {
    editor?.chain().focus().deleteTable().run()
  }, [editor])

  const addColumnBefore = useCallback(() => {
    editor?.chain().focus().addColumnBefore().run()
  }, [editor])

  const addColumnAfter = useCallback(() => {
    editor?.chain().focus().addColumnAfter().run()
  }, [editor])

  const deleteColumn = useCallback(() => {
    editor?.chain().focus().deleteColumn().run()
  }, [editor])

  const addRowBefore = useCallback(() => {
    editor?.chain().focus().addRowBefore().run()
  }, [editor])

  const addRowAfter = useCallback(() => {
    editor?.chain().focus().addRowAfter().run()
  }, [editor])

  const deleteRow = useCallback(() => {
    editor?.chain().focus().deleteRow().run()
  }, [editor])

  const toggleHeaderRow = useCallback(() => {
    editor?.chain().focus().toggleHeaderRow().run()
  }, [editor])

  const toggleHeaderColumn = useCallback(() => {
    editor?.chain().focus().toggleHeaderColumn().run()
  }, [editor])

  const mergeCells = useCallback(() => {
    editor?.chain().focus().mergeCells().run()
  }, [editor])

  const splitCell = useCallback(() => {
    editor?.chain().focus().splitCell().run()
  }, [editor])

  return {
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
    toggleHeaderColumn,
    mergeCells,
    splitCell,
  }
}
