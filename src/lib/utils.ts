import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * design-system-v2 커스텀 타입 토큰(text-title 등)을 font-size 그룹으로 등록.
 * 등록하지 않으면 tailwind-merge 가 이를 색상으로 오인해 `text-fg` 등과 함께 쓸 때 지워 버린다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["title", "heading", "subheading", "reading", "body", "label", "meta", "micro"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
