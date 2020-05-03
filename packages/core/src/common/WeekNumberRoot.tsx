import { createFormatter, FormatterInput } from '../datelib/formatting'
import { ComponentContext, ComponentContextType } from '../component/ComponentContext'
import { DateMarker } from '../datelib/marker'
import { RenderHook, RenderHookPropsChildren } from './render-hook'
import { h } from '../vdom'


export interface WeekNumberRootProps {
  date: DateMarker
  defaultFormat: FormatterInput
  children: RenderHookPropsChildren
}


export const WeekNumberRoot = (props: WeekNumberRootProps) => (
  <ComponentContextType.Consumer>
    {(context: ComponentContext) => {
      let { date } = props
      let format = createFormatter(context.options.weekNumberFormat || props.defaultFormat) // TODO: precompute
      let num = context.dateEnv.computeWeekNumber(date) // TODO: somehow use for formatting as well?
      let text = context.dateEnv.format(date, format)
      let hookProps = { num, text, date }

      return (
        <RenderHook name='weekNumber' hookProps={hookProps} defaultContent={renderInner}>
          {props.children}
        </RenderHook>
      )
    }}
  </ComponentContextType.Consumer>
)


function renderInner(innerProps) {
  return innerProps.text
}
