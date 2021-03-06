import {
  Component,
  Injectable,
  Input,
  OnInit
} from '@angular/core'
import * as CodeMirror from 'codemirror'

import { EditorService } from '../editor.service'

@Component({
  selector: 'mute-style-toolbar',
  templateUrl: './style-toolbar.component.html',
  styleUrls: ['./style-toolbar.component.scss'],
  providers: [ EditorService ]
})

@Injectable()
export class StyleToolbarComponent implements OnInit {

  @Input() cm: CodeMirror.Editor

  private buttons: any[] = new Array()
  private toolbarWidth: number
  private toolbar: any

  constructor (
    private editorService: EditorService
  ) {}

  ngOnInit () {
    this.toolbar = document.getElementsByClassName('mute-style-toolbar')[0]
    this.getToggleButtons()
    this.toolbarWidth = this.removePx(getComputedStyle(this.toolbar).width)
    this.setListeners()
  }

  // UPDATE TOOLBAR VISIBILITY
  setListeners (): void {
    this.cm.on('cursorActivity', () => { this.updateToolbarState() })

    // Handles 'on blur'
    const editor = document.getElementsByTagName('mute-editor')[0]
    editor.addEventListener('mousedown', this.checkThenHide.bind(this))

    this.cm.addKeyMap({Esc: () => this.hideToolbar() })
  }

  checkThenHide (event: Event): void {
    const editor = document.getElementsByTagName('mute-editor')[0]
    if (event.target === editor) {
      this.hideToolbar()
    }
  }

  hideToolbar (): void {
    if (this.toolbar.classList.contains('active')) {
      if (this.cm.getDoc().somethingSelected()) { // For 'Esc', so the selection is removed
        this.cm.getDoc().setSelection(this.cm.getDoc().getCursor(), this.cm.getDoc().getCursor())
      }
      this.resetToggledButtons()
      this.toolbar.classList.remove('active')
      this.toolbar.classList.add('inactive')
    }
  }

  updateToolbarState (): void {
    if (this.cm.getDoc().somethingSelected() && this.toolbar.classList.contains('inactive')) {
      this.setToggledButtons()
      this.setToolbarLocation()
      this.toolbar.classList.remove('inactive')
      this.toolbar.classList.add('active')
    } else if (!this.cm.getDoc().somethingSelected()) {
      this.hideToolbar()
    } else if (this.toolbar.classList.contains('active')) {
      this.setToggledButtons()
      this.setToolbarLocation()
    }
  }

  // SET TOOLBAR UP
  resetToggledButtons (): void {
    this.buttons.forEach((button) => {
      if (button.classList.contains('mat-button-toggle-checked')) {
        button.classList.remove('mat-button-toggle-checked')
      }
    })
  }

  setToggledButtons (): void {
    const selection = this.cm.getDoc().listSelections()[0]
    const sum = (selection.anchor.ch + selection.head.ch) / 2
    const selectionStyles = (this.cm.getTokenAt({ch: sum, line: selection.anchor.line})).type
    const existingStyles = ['strong', 'em', 'strikethrough', 'quote', 'link']
    let buttonIndex = 0
    existingStyles.forEach((style) => {
      if (selectionStyles && selectionStyles.includes(style)) {
        this.buttons[buttonIndex].classList.add('mat-button-toggle-checked')
      } else if (this.buttons[buttonIndex].classList.contains('mat-button-toggle-checked')) {
        this.buttons[buttonIndex].classList.remove('mat-button-toggle-checked')
      }
      buttonIndex++
    })
    this.cm.getDoc().setSelection(selection.anchor, selection.head)
  }

  setToolbarLocation (): void {
    const width: number = this.removePx(getComputedStyle(document.getElementsByTagName('mute-editor')[0] as any).borderLeft) // not ideal

    const line: number = this.getUpperLine()
    const top: number = this.getTopFromSelection(line)
    let left: number = this.getLeftFromMiddleOfSelection(line)
    let right: number = this.getRightFromMiddleOfSelection(line)

    let horizontalPosition = ''

    if (left < this.toolbarWidth / 2) {
      left = 0
      horizontalPosition = 'left: ' + left + 'px;'
    } else {
      if (right < width - this.toolbarWidth / 2) {
        right = 0
        horizontalPosition = 'right: ' + right + 'px;'
      } else {
        left -= this.toolbarWidth / 2
        horizontalPosition = 'left: ' + left + 'px;'
      }
    }
    this.toolbar.style = 'top: ' + top + 'px; ' + horizontalPosition
  }

  // ACCESS LOCATION OF SELECTION
  getLeftFromMiddleOfSelection (line: number): number {
    const selection = this.cm.getDoc().listSelections()[0]
    const anchor = selection.anchor.ch
    const head = selection.head.ch
    const middleOfSelection = Math.floor((head + anchor) / 2)
    const charCoords = this.cm.charCoords({line, ch: middleOfSelection}, 'window')
    return charCoords.left
  }

  getRightFromMiddleOfSelection (line: number): number {
    const selection = this.cm.getDoc().listSelections()[0]
    const anchor = selection.anchor.ch
    const head = selection.head.ch
    const middleOfSelection = Math.floor((head + anchor) / 2)
    const charCoords = this.cm.charCoords({line, ch: middleOfSelection}, 'window')
    return charCoords.right
  }

  getTopFromSelection (line: number): number {
    const charCoords = this.cm.charCoords({line, ch: 0}, 'local')
    return charCoords.top - 8
  }

  getUpperLine (): number {
    const selection = this.cm.getDoc().listSelections()[0]
    const anchor = selection.anchor.line
    const head = selection.head.line
    return Math.min(anchor, head)
  }

  // BUTTONS FUNCTIONNALITIES
  toggleBold (): void {
    this.editorService.toggleStyle(this.cm, '__', {__: new RegExp('[\\s\\S]*__[\\s\\S]*__[\\s\\S]*'),
      '**': new RegExp('[\\s\\S]*\\*\\*[\\s\\S]*\\*\\*[\\s\\S]*')})
  }

  toggleItalic (): void {
    this.editorService.toggleStyle(this.cm, '_', {_: new RegExp('[^_]*(_|___)[^_][\\s\\S]*[^_](_|___)[^_]*', 'y'),
      '*': new RegExp('[^\\*]*(\\*|\\*\\*\\*)[^\\*][\\s\\S]*[^\\*](\\*|\\*\\*\\*)[^\\*]*', 'y')})
  }

  toggleStrikethrough (): void {
    this.editorService.toggleStyle(this.cm, '~~', {'~~': new RegExp('.*~~.*~~.*')})
  }

  createQuotation (): void {
    this.cm.getDoc().replaceSelection('>' + this.getSelectionForHeadersListsOrQuotations(), 'around')
  }

  handleLink (): void {
    this.editorService.handleLink(this.cm.getDoc())
  }

  addHeader (headerSize: number): void {
    const selection = this.getSelectionForHeadersListsOrQuotations()
    let mdSyntax
    switch (headerSize) {
    case 1:
      mdSyntax = '# '
      break
    case 2:
      mdSyntax = '## '
      break
    case 3:
      mdSyntax = '### '
      break
    case 4:
      mdSyntax = '#### '
      break
    case 5:
      mdSyntax = '##### '
      break
    }
    let list = ''
    let beginningIndexOfSubSelection = 0
    for (let i = 0; i < selection.length; i++) {
      if (selection[i] === '\n' || i === selection.length - 1) {
        list += mdSyntax + selection.slice(beginningIndexOfSubSelection, i + 1)
        beginningIndexOfSubSelection = i + 1
      }
    }
    this.cm.getDoc().replaceSelection(list, 'around')
  }

  createList (bullet: number): void {
    const selection = this.getSelectionForHeadersListsOrQuotations()
    let mdSyntax
    switch (+(bullet)) {
    case 0:
      mdSyntax = '. '
      break
    case 1:
      mdSyntax = '- '
      break
    case 2:
      mdSyntax = '* '
      break
    case 3:
      mdSyntax = '+ '
      break
    case 4:
      mdSyntax = '- [ ] '
      break
    }
    let list = ''
    let beginningIndexOfSubSelection = 0
    let counter = 1
    for (let i = 0; i < selection.length; i++) {
      if (selection[i] === '\n' || i === selection.length - 1) {
        if (mdSyntax === '. ') {
          list += counter + mdSyntax + selection.slice(beginningIndexOfSubSelection, i + 1)
          counter++
        } else {
          list += mdSyntax + selection.slice(beginningIndexOfSubSelection, i + 1)
        }
        beginningIndexOfSubSelection = i + 1
      }
    }
    this.cm.getDoc().replaceSelection(list, 'around')
  }

  // TOOLS
  getToggleButtons (): void {
    this.toolbar.childNodes.forEach((child) => {
      if (child.className && child.classList.contains('mat-button-toggle')) {
        this.buttons.push(child)
      }
    })
  }

  getSelectionForHeadersListsOrQuotations (): string {
    const beginningOfSelection = this.editorService.getBeginningOfSelection(this.cm.getDoc())
    beginningOfSelection.ch = 0
    this.cm.getDoc().setSelection(beginningOfSelection, this.editorService.getEndOfSelection(this.cm.getDoc()))
    return this.cm.getDoc().getSelection()
  }

  removePx (cssSize: string): number {
    return +(cssSize.slice(0, -2))
  }

}
