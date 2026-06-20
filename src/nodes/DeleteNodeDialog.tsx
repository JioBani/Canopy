import { useState } from "react"
import { useNodes } from "@/nodes/NodesProvider"
import type { AppNode } from "@/lib/nodes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  node: AppNode | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteNodeDialog({ node, open, onOpenChange }: Props) {
  const { descendantCount, removeNode } = useNodes()
  const [busy, setBusy] = useState(false)

  const count = node ? descendantCount(node.id) : 0

  async function confirm() {
    if (!node || busy) return
    setBusy(true)
    try {
      await removeNode(node.id)
      onOpenChange(false)
    } catch (e) {
      console.error("[nodes] 삭제 실패:", e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-dialog">
        <DialogHeader>
          <DialogTitle>노드 삭제</DialogTitle>
          <DialogDescription data-testid="delete-message">
            {count > 0
              ? `‘${node?.title}’ 와(과) 하위 ${count}개 항목을 함께 삭제합니다. 되돌릴 수 없습니다.`
              : `‘${node?.title}’ 을(를) 삭제합니다. 되돌릴 수 없습니다.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={confirm}
            data-testid="confirm-delete"
          >
            {busy ? "삭제 중…" : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
