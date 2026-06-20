import { useCallback, useEffect, useState, type KeyboardEvent } from "react"
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react"
import {
  deleteUr,
  deleteUrGroup,
  insertUr,
  insertUrGroup,
  listUrCoverageByFeature,
  listUrGroups,
  listUrs,
  renameUrGroup,
  updateUr,
  type Ur,
  type UrCoverage,
  type UrGroup,
} from "@/lib/ur"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function nextOrder<T extends { sort_order: number }>(items: T[]): number {
  return items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
}

/** 한 줄 인라인 입력 (Enter 저장, Esc 취소). */
function InlineText({
  initial = "",
  placeholder,
  onSave,
  onCancel,
  testid,
}: {
  initial?: string
  placeholder: string
  onSave: (v: string) => void
  onCancel: () => void
  testid: string
}) {
  const [v, setV] = useState(initial)
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (v.trim()) onSave(v.trim())
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }
  return (
    <Input
      autoFocus
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={onKey}
      onBlur={() => {
        if (v.trim() && v.trim() !== initial) onSave(v.trim())
        else onCancel()
      }}
      className="h-7"
      data-testid={testid}
    />
  )
}

function CoverageBadge({ cov }: { cov: UrCoverage | undefined }) {
  if (!cov || cov.is_uncovered) {
    return (
      <span
        className="text-destructive inline-flex items-center gap-1 text-xs"
        data-testid="ur-coverage"
        data-uncovered="true"
        title="연결된 작업이 없습니다 (미커버 요구사항)"
      >
        <AlertTriangle className="size-3.5" /> 미커버
      </span>
    )
  }
  return (
    <span
      className="text-muted-foreground text-xs tabular-nums"
      data-testid="ur-coverage"
      data-uncovered="false"
    >
      작업 {cov.linked_work_count} / 완료 {cov.done_work_count}
    </span>
  )
}

export function FeatureUrPanel({ featureId }: { featureId: string }) {
  const [groups, setGroups] = useState<UrGroup[]>([])
  const [urs, setUrs] = useState<Ur[]>([])
  const [cov, setCov] = useState<Map<string, UrCoverage>>(new Map())
  const [loading, setLoading] = useState(true)
  const [addingIn, setAddingIn] = useState<string | "none" | null>(null) // group id, "none"=미분류, null=없음
  const [editingUr, setEditingUr] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [g, u, c] = await Promise.all([
      listUrGroups(featureId),
      listUrs([featureId]),
      listUrCoverageByFeature(featureId),
    ])
    setGroups(g)
    setUrs(u)
    setCov(new Map(c.map((x) => [x.ur_id, x])))
    setLoading(false)
  }, [featureId])

  useEffect(() => {
    reload().catch((e) => {
      console.error("[ur] 로드 실패:", e)
      setLoading(false)
    })
  }, [reload])

  async function addUr(groupId: string | null, text: string) {
    const scoped = urs.filter((u) => u.ur_group_id === groupId)
    await insertUr({
      feature_id: featureId,
      ur_group_id: groupId,
      text,
      sort_order: nextOrder(scoped),
    })
    setAddingIn(null)
    await reload()
  }

  function ursOf(groupId: string | null) {
    return urs.filter((u) => u.ur_group_id === groupId)
  }

  const sections: { id: string | null; name: string }[] = [
    ...groups.map((g) => ({ id: g.id as string | null, name: g.name })),
    { id: null, name: "미분류" },
  ]

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm" data-testid="feature-ur-panel">
        UR 불러오는 중…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="feature-ur-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">사용자 요구사항 (UR)</h3>
        {addingGroup ? (
          <div className="w-48">
            <InlineText
              placeholder="그룹명"
              testid="ur-group-name-input"
              onSave={async (name) => {
                await insertUrGroup(featureId, name, nextOrder(groups))
                setAddingGroup(false)
                await reload()
              }}
              onCancel={() => setAddingGroup(false)}
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setAddingGroup(true)}
            data-testid="add-ur-group"
          >
            <Plus className="size-3.5" />그룹
          </Button>
        )}
      </div>

      {sections.map((sec) => {
        const list = ursOf(sec.id)
        // 미분류는 비어있고 그룹이 따로 있으면 숨김(노이즈 방지)
        if (sec.id === null && list.length === 0 && groups.length > 0) return null
        return (
          <div key={sec.id ?? "none"} className="flex flex-col gap-1" data-testid="ur-group">
            <div className="flex items-center gap-1">
              {renamingGroup === sec.id && sec.id ? (
                <InlineText
                  initial={sec.name}
                  placeholder="그룹명"
                  testid="ur-group-name-input"
                  onSave={async (name) => {
                    await renameUrGroup(sec.id!, name)
                    setRenamingGroup(null)
                    await reload()
                  }}
                  onCancel={() => setRenamingGroup(null)}
                />
              ) : (
                <span className="text-muted-foreground text-xs font-medium" data-testid="ur-group-name">
                  {sec.name}
                </span>
              )}
              {sec.id && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5"
                    onClick={() => setRenamingGroup(sec.id!)}
                    data-testid="ur-group-rename"
                    title="그룹 이름변경"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-5"
                    onClick={async () => {
                      await deleteUrGroup(sec.id!)
                      await reload()
                    }}
                    data-testid="ur-group-delete"
                    title="그룹 삭제(소속 UR 은 미분류로)"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 gap-1 px-2 text-xs"
                onClick={() => setAddingIn(sec.id ?? "none")}
                data-testid="add-ur"
              >
                <Plus className="size-3" />UR
              </Button>
            </div>

            {list.map((u) => (
              <div
                key={u.id}
                className="group/ur border-border bg-card flex items-center gap-2 rounded-[10px] border px-3 py-2"
                data-testid="ur-row"
              >
                {editingUr === u.id ? (
                  <InlineText
                    initial={u.text}
                    placeholder="요구사항"
                    testid="ur-text-input"
                    onSave={async (text) => {
                      await updateUr(u.id, { text })
                      setEditingUr(null)
                      await reload()
                    }}
                    onCancel={() => setEditingUr(null)}
                  />
                ) : (
                  <>
                    <span
                      className="flex-1 text-[13.5px] leading-relaxed"
                      data-testid="ur-text"
                      onDoubleClick={() => setEditingUr(u.id)}
                    >
                      {u.text}
                    </span>
                    <CoverageBadge cov={cov.get(u.id)} />
                    <span className="flex opacity-0 group-hover/ur:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        onClick={() => setEditingUr(u.id)}
                        data-testid="ur-edit"
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-5"
                        onClick={async () => {
                          await deleteUr(u.id)
                          await reload()
                        }}
                        data-testid="ur-delete"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </span>
                  </>
                )}
              </div>
            ))}

            {addingIn === (sec.id ?? "none") && (
              <InlineText
                placeholder="요구사항 입력 후 Enter"
                testid="ur-text-input"
                onSave={(text) => void addUr(sec.id, text)}
                onCancel={() => setAddingIn(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
