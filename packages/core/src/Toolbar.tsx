import { h } from './vdom'
import { BaseComponent } from './vdom-util'
import { ToolbarModel, ToolbarWidget } from './toolbar-parse'
import { ComponentContext } from './component/ComponentContext'


export interface ToolbarProps extends ToolbarContent {
  extraClassName: string // wish this could be array, but easier for pureness
  model: ToolbarModel
}

export interface ToolbarContent {
  title: string
  activeButton: string
  isTodayEnabled: boolean
  isPrevEnabled: boolean
  isNextEnabled: boolean
}


export class Toolbar extends BaseComponent<ToolbarProps> {

  render(props: ToolbarProps) {
    let { model } = props
    let forceLtr = false
    let startContent, endContent
    let centerContent = model.center

    if (model.left) {
      forceLtr = true
      startContent = model.left
    } else {
      startContent = model.start
    }

    if (model.right) {
      forceLtr = true
      endContent = model.right
    } else {
      endContent = model.end
    }

    let classNames = [
      props.extraClassName || '',
      'fc-toolbar',
      forceLtr ? 'fc-toolbar-ltr' : ''
    ]

    return (
      <div class={classNames.join(' ')}>
        {this.renderSection(startContent || [])}
        {this.renderSection(centerContent || [])}
        {this.renderSection(endContent || [])}
      </div>
    )
  }


  renderSection(widgetGroups: ToolbarWidget[][]) {
    let { props } = this

    return (
      <ToolbarSection
        widgetGroups={widgetGroups}
        title={props.title}
        activeButton={props.activeButton}
        isTodayEnabled={props.isTodayEnabled}
        isPrevEnabled={props.isPrevEnabled}
        isNextEnabled={props.isNextEnabled}
      />
    )
  }

}


interface ToolbarSectionProps extends ToolbarContent {
  widgetGroups: ToolbarWidget[][]
}

class ToolbarSection extends BaseComponent<ToolbarSectionProps> {

  render(props: ToolbarSectionProps, state: {}, context: ComponentContext) {
    let { theme } = context

    return (
      <div class='fc-toolbar-chunk'>
        {props.widgetGroups.map((widgetGroup: ToolbarWidget[]) => {
          let children = []
          let isOnlyButtons = true

          for (let widget of widgetGroup) {
            let { buttonName, buttonClick, buttonText, buttonIcon } = widget

            if (buttonName === 'title') {
              isOnlyButtons = false
              children.push(
                <h2 className='fc-toolbar-title'>{props.title}</h2>
              )

            } else {
              let ariaAttrs = buttonIcon ? { 'aria-label': buttonName } : {}

              let buttonClasses = [ 'fc-' + buttonName + '-button', theme.getClass('button') ]
              if (buttonName === props.activeButton) {
                buttonClasses.push(theme.getClass('buttonActive'))
              }

              let isDisabled =
                (!props.isTodayEnabled && buttonName === 'today') ||
                (!props.isPrevEnabled && buttonName === 'prev') ||
                (!props.isNextEnabled && buttonName === 'next')

              children.push(
                <button
                  disabled={isDisabled}
                  class={buttonClasses.join(' ')}
                  onClick={buttonClick}
                  { ...ariaAttrs }
                >{ buttonText || (buttonIcon ? <span class={buttonIcon} /> : '')}</button>
              )
            }
          }

          if (children.length > 1) {
            let groupClasses = (isOnlyButtons && theme.getClass('buttonGroup')) || ''

            return (<div class={groupClasses}>{children}</div>)
          } else {
            return children[0]
          }

        })}
      </div>
    )
  }

}
