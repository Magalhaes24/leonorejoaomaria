// Set to false to disable most UI animations in one place.
export const MOTION_ENABLED = true

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const

export function motionProps<T>(props: T): T | Record<string, never> {
  return MOTION_ENABLED ? props : {}
}

export function motionValue<TEnabled, TDisabled>(enabledValue: TEnabled, disabledValue: TDisabled): TEnabled | TDisabled {
  return MOTION_ENABLED ? enabledValue : disabledValue
}

export function presenceProps<T>(props: T): T | { initial: false } {
  return MOTION_ENABLED ? props : { initial: false }
}
