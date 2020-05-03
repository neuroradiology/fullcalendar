import { Seg } from '../component/DateComponent'
import { ComponentChildren, h, Ref, createRef } from '../vdom'
import { ComponentContext } from '../component/ComponentContext'
import { EventApi } from '../api/EventApi'
import { computeSegDraggable, computeSegStartResizable, computeSegEndResizable, setElSeg } from '../component/event-rendering'
import { EventMeta, getSkinCss, getEventClassNames } from '../component/event-rendering'
import { RenderHook } from './render-hook'
import { BaseComponent } from '../vdom-util'


export interface MinimalEventProps {
  seg: Seg
  isDragging: boolean      // rename to isMirrorDragging? make optional?
  isResizing: boolean      // rename to isMirrorResizing? make optional?
  isDateSelecting: boolean // rename to isMirrorDateSelecting? make optional?
  isSelected: boolean
  isPast: boolean
  isFuture: boolean
  isToday: boolean
}

export interface EventRootProps extends MinimalEventProps {
  timeText: string
  disableDragging?: boolean
  disableResizing?: boolean
  defaultContent: (hookProps: EventMeta) => ComponentChildren
  children: (
    rootElRef: Ref<any>,
    classNames: string[],
    style: any,
    innerElRef: Ref<any>,
    innerContent: ComponentChildren,
    hookProps: EventMeta
  ) => ComponentChildren
}


export class EventRoot extends BaseComponent<EventRootProps> {

  elRef = createRef<HTMLElement>()


  render(props: EventRootProps, state: {}, context: ComponentContext) {
    let { seg } = props
    let { eventRange } = seg
    let { ui } = eventRange

    let hookProps: EventMeta = {
      event: new EventApi(context, eventRange.def, eventRange.instance),
      view: context.viewApi,
      timeText: props.timeText,
      textColor: ui.textColor,
      backgroundColor: ui.backgroundColor,
      borderColor: ui.borderColor,
      isDraggable: !props.disableDragging && computeSegDraggable(seg, context),
      isStartResizable: !props.disableResizing && computeSegStartResizable(seg, context),
      isEndResizable: !props.disableResizing && computeSegEndResizable(seg, context),
      isMirror: Boolean(props.isDragging || props.isResizing || props.isDateSelecting),
      isStart: Boolean(seg.isStart),
      isEnd: Boolean(seg.isEnd),
      isPast: Boolean(props.isPast), // TODO: don't cast. getDateMeta does it
      isFuture: Boolean(props.isFuture), // TODO: don't cast. getDateMeta does it
      isToday: Boolean(props.isToday), // TODO: don't cast. getDateMeta does it
      isSelected: Boolean(props.isSelected),
      isDragging: Boolean(props.isDragging),
      isResizing: Boolean(props.isResizing)
    }

    let style = getSkinCss(ui)
    let standardClassNames = getEventClassNames(hookProps).concat(ui.classNames)

    return (
      <RenderHook
        name='event'
        hookProps={hookProps}
        defaultContent={props.defaultContent}
        elRef={this.elRef}
      >
        {(rootElRef, customClassNames, innerElRef, innerContent) => props.children(
          rootElRef, standardClassNames.concat(customClassNames), style, innerElRef, innerContent, hookProps
        )}
      </RenderHook>
    )
  }


  componentDidMount() {
    setElSeg(this.elRef.current, this.props.seg)
  }


  /*
  need to re-assign seg to the element if seg changes, even if the element is the same
  */
  componentDidUpdate(prevProps: EventRootProps) {
    let { seg } = this.props

    if (seg !== prevProps.seg) {
      setElSeg(this.elRef.current, seg)
    }
  }

}
