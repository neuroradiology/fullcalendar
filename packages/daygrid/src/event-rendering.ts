import { EventRenderRange, diffDays } from '@fullcalendar/core'


export const DEFAULT_TABLE_EVENT_TIME_FORMAT = {
  hour: 'numeric',
  minute: '2-digit',
  omitZeroMinute: true,
  meridiem: 'narrow'
}


export function hasListItemDisplay(eventRange: EventRenderRange) {
  let { display } = eventRange.ui
  let isAuto = !display || display === 'auto' // TODO: normalize earlier on

  return display === 'list-item' || (
    isAuto &&
    !eventRange.def.allDay &&
      diffDays(eventRange.instance.range.start, eventRange.instance.range.end) <= 1 // TODO: use nextDayThreshold
  )
}
