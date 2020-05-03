import { ComponentContextType, buildViewContext } from './component/ComponentContext'
import { ViewSpec } from './structs/view-spec'
import { ViewProps } from './View'
import { Toolbar } from './Toolbar'
import { DateProfileGenerator, DateProfile } from './DateProfileGenerator'
import { rangeContainsMarker } from './datelib/date-range'
import { memoize } from './util/memoize'
import { DateMarker } from './datelib/marker'
import { CalendarState } from './reducers/CalendarState'
import { ViewPropsTransformerClass } from './plugin-system-struct'
import { __assign } from 'tslib'
import { h, createRef, Component } from './vdom'
import { buildDelegationHandler } from './util/dom-event'
import { capitaliseFirstLetter } from './util/misc'
import { ViewContainer } from './ViewContainer'
import { CssDimValue } from './scrollgrid/util'
import { Theme } from './theme/Theme'
import { getCanVGrowWithinCell } from './util/table-styling'
import { ViewComponent } from './structs/view-config'
import { Interaction, InteractionSettingsInput, InteractionClass, parseInteractionSettings, interactionSettingsStore } from './interactions/interaction'
import { DateComponent } from './component/DateComponent'
import { EventClicking } from './interactions/EventClicking'
import { EventHovering } from './interactions/EventHovering'
import { getNow } from './reducers/current-date'
import { CalendarInteraction } from './calendar-utils'
import { DelayedRunner } from './util/runner'


export interface CalendarComponentProps extends CalendarState {
  onClassNameChange?: (classNameHash) => void // will be fired with [] on cleanup
  onHeightChange?: (height: CssDimValue) => void // will be fired with '' on cleanup
}

interface CalendarComponentState {
  forPrint: boolean
}


export class CalendarComponent extends Component<CalendarComponentProps, CalendarComponentState> {

  context: never

  private buildViewContext = memoize(buildViewContext)
  private buildViewPropTransformers = memoize(buildViewPropTransformers)
  private buildToolbarProps = memoize(buildToolbarProps)
  private reportClassNames = memoize(reportClassNames)
  private reportHeight = memoize(reportHeight)
  private handleNavLinkClick = buildDelegationHandler('a[data-navlink]', this._handleNavLinkClick.bind(this))
  private headerRef = createRef<Toolbar>()
  private footerRef = createRef<Toolbar>()
  private viewRef = createRef<ViewComponent>()
  private interactionsStore: { [componentUid: string]: Interaction[] } = {}
  private calendarInteractions: CalendarInteraction[]

  state = {
    forPrint: false
  }


  /*
  renders INSIDE of an outer div
  */
  render(props: CalendarComponentProps, state: CalendarComponentState) {
    let { toolbarConfig, theme, options } = props

    let toolbarProps = this.buildToolbarProps(
      props.viewSpec,
      props.dateProfile,
      props.dateProfileGenerator,
      props.currentDate,
      getNow(props), // TODO: use NowTimer????
      props.viewTitle
    )

    let calendarHeight: string | number = ''
    let viewVGrow = false
    let viewHeight: string | number = ''
    let viewAspectRatio: number | undefined

    if (isHeightAuto(options)) {
      viewHeight = ''
    } else if (options.height != null) {
      calendarHeight = options.height
      viewVGrow = true
    } else if (options.contentHeight != null) {
      viewHeight = options.contentHeight
    } else {
      viewAspectRatio = Math.max(options.aspectRatio, 0.5) // prevent from getting too tall
    }

    if (props.onClassNameChange) {
      this.reportClassNames(props.onClassNameChange, state.forPrint, options.direction, theme)
    }

    if (props.onHeightChange) {
      this.reportHeight(props.onHeightChange, calendarHeight)
    }

    let viewContext = this.buildViewContext(
      props.viewSpec,
      props.viewApi,
      props.options,
      props.computedOptions,
      props.dateProfileGenerator,
      props.dateEnv,
      props.theme,
      props.pluginHooks,
      props.dispatch,
      props.getCurrentState,
      props.emitter,
      props.calendarApi,
      this.registerInteractiveComponent,
      this.unregisterInteractiveComponent
    )

    return (
      <ComponentContextType.Provider value={viewContext}>
        {toolbarConfig.headerToolbar &&
          <Toolbar
            ref={this.headerRef}
            extraClassName='fc-header-toolbar'
            model={toolbarConfig.headerToolbar}
            { ...toolbarProps }
          />
        }
        <ViewContainer
          liquid={viewVGrow}
          height={viewHeight}
          aspectRatio={viewAspectRatio}
          onClick={this.handleNavLinkClick}
        >
          {this.renderView(props)}
          {this.buildAppendContent()}
        </ViewContainer>
        {toolbarConfig.footerToolbar &&
          <Toolbar
            ref={this.footerRef}
            extraClassName='fc-footer-toolbar'
            model={toolbarConfig.footerToolbar}
            { ...toolbarProps }
          />
        }
      </ComponentContextType.Provider>
    )
  }


  componentDidMount() {
    window.addEventListener('beforeprint', this.handleBeforePrint)
    window.addEventListener('afterprint', this.handleAfterPrint)

    let { props } = this
    this.calendarInteractions = props.pluginHooks.calendarInteractions
      .map((calendarInteractionClass) => {
        return new calendarInteractionClass(props)
      })

    window.addEventListener('resize', this.handleWindowResize)

    this.props.emitter.trigger('datesDidUpdate')
  }


  componentDidUpdate(prevProps: CalendarComponentProps) {
    if (prevProps.dateProfile !== this.props.dateProfile) {
      this.props.emitter.trigger('datesDidUpdate')
    }
  }


  componentWillUnmount() {
    window.removeEventListener('beforeprint', this.handleBeforePrint)
    window.removeEventListener('afterprint', this.handleAfterPrint)

    window.removeEventListener('resize', this.handleWindowResize)
    this.resizeRunner.clear()

    for (let interaction of this.calendarInteractions) {
      interaction.destroy()
    }

    if (this.props.onClassNameChange) {
      this.props.onClassNameChange([])
    }

    if (this.props.onHeightChange) {
      this.props.onHeightChange('')
    }

    this.props.emitter.trigger('_destroyed')
  }


  handleBeforePrint = () => {
    this.setState({ forPrint: true })
  }

  handleAfterPrint = () => {
    this.setState({ forPrint: false })
  }


  _handleNavLinkClick(ev: UIEvent, anchorEl: HTMLElement) {
    let { dateEnv, options, calendarApi } = this.props

    let navLinkOptions: any = anchorEl.getAttribute('data-navlink')
    navLinkOptions = navLinkOptions ? JSON.parse(navLinkOptions) : {}

    let dateMarker = dateEnv.createMarker(navLinkOptions.date)
    let viewType = navLinkOptions.type

    // property like "navLinkDayClick". might be a string or a function
    let customAction = options['navLink' + capitaliseFirstLetter(viewType) + 'Click']

    if (typeof customAction === 'function') {
      customAction(dateEnv.toDate(dateMarker), ev)

    } else {
      if (typeof customAction === 'string') {
        viewType = customAction
      }

      calendarApi.zoomTo(dateMarker, viewType)
    }
  }


  buildAppendContent() {
    let { props } = this

    return props.pluginHooks.viewContainerAppends.map(
      (buildAppendContent) => buildAppendContent(props)
    )
  }


  renderView(props: CalendarComponentProps) {
    let { pluginHooks, options } = props
    let { viewSpec } = props

    let viewProps: ViewProps = {
      dateProfile: props.dateProfile,
      businessHours: props.businessHours,
      eventStore: props.renderableEventStore, // !
      eventUiBases: props.eventUiBases,
      dateSelection: props.dateSelection,
      eventSelection: props.eventSelection,
      eventDrag: props.eventDrag,
      eventResize: props.eventResize,
      isHeightAuto: this.state.forPrint || isHeightAuto(options),
      forPrint: this.state.forPrint
    }

    let transformers = this.buildViewPropTransformers(pluginHooks.viewPropsTransformers)

    for (let transformer of transformers) {
      __assign(
        viewProps,
        transformer.transform(viewProps, viewSpec, props, options)
      )
    }

    let ViewComponent = viewSpec.component

    return (
      <ViewComponent
        ref={this.viewRef}
        { ...viewProps }
      />
    )
  }


  // Component Registration
  // -----------------------------------------------------------------------------------------------------------------


  registerInteractiveComponent = (component: DateComponent<any>, settingsInput: InteractionSettingsInput) => {
    let settings = parseInteractionSettings(component, settingsInput)
    let DEFAULT_INTERACTIONS: InteractionClass[] = [
      EventClicking,
      EventHovering
    ]
    let interactionClasses: InteractionClass[] = DEFAULT_INTERACTIONS.concat(
      this.props.pluginHooks.componentInteractions
    )
    let interactions = interactionClasses.map((interactionClass) => {
      return new interactionClass(settings)
    })

    this.interactionsStore[component.uid] = interactions
    interactionSettingsStore[component.uid] = settings
  }


  unregisterInteractiveComponent = (component: DateComponent<any>) => {

    for (let listener of this.interactionsStore[component.uid]) {
      listener.destroy()
    }

    delete this.interactionsStore[component.uid]
    delete interactionSettingsStore[component.uid]
  }


  // Resizing
  // -----------------------------------------------------------------------------------------------------------------


  resizeRunner = new DelayedRunner(() => {
    this.props.emitter.trigger('_resize', true) // should window resizes be considered "forced" ?
    this.props.emitter.trigger('windowResize')
  })


  handleWindowResize = (ev: UIEvent) => {
    let { options } = this.props

    if (
      options.handleWindowResize &&
      ev.target === window // avoid jqui events
    ) {
      this.resizeRunner.request(options.windowResizeDelay)
    }
  }

}


function buildToolbarProps(
  viewSpec: ViewSpec,
  dateProfile: DateProfile,
  dateProfileGenerator: DateProfileGenerator,
  currentDate: DateMarker,
  now: DateMarker,
  title: string
) {
  // don't force any date-profiles to valid date profiles (the `false`) so that we can tell if it's invalid
  let todayInfo = dateProfileGenerator.build(now, undefined, false) // TODO: need `undefined` or else INFINITE LOOP for some reason
  let prevInfo = dateProfileGenerator.buildPrev(dateProfile, currentDate, false)
  let nextInfo = dateProfileGenerator.buildNext(dateProfile, currentDate, false)

  return {
    title,
    activeButton: viewSpec.type,
    isTodayEnabled: todayInfo.isValid && !rangeContainsMarker(dateProfile.currentRange, now),
    isPrevEnabled: prevInfo.isValid,
    isNextEnabled: nextInfo.isValid
  }
}


function isHeightAuto(options) {
  return options.height === 'auto' || options.contentHeight === 'auto'
}


// Outer Div Rendering
// -----------------------------------------------------------------------------------------------------------------


function reportClassNames(onClassNameChange, forPrint: boolean, direction: string, theme: Theme) {
  onClassNameChange(computeClassNames(forPrint, direction, theme))
}


// NOTE: can't have any empty! caller gets confused
function computeClassNames(forPrint: boolean, direction: string, theme: Theme) {
  let classNames: string[] = [
    'fc',
    forPrint ? 'fc-media-print' : 'fc-media-screen',
    'fc-direction-' + direction,
    theme.getClass('root')
  ]

  if (!getCanVGrowWithinCell()) {
    classNames.push('fc-liquid-hack')
  }

  return classNames
}


function reportHeight(onHeightChange, height: CssDimValue) {
  onHeightChange(height)
}



// Plugin
// -----------------------------------------------------------------------------------------------------------------


function buildViewPropTransformers(theClasses: ViewPropsTransformerClass[]) {
  return theClasses.map(function(theClass) {
    return new theClass()
  })
}
