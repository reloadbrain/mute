import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Injectable,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'
import { DocService } from 'mute-core'
import { TextDelete, TextInsert, TextOperation } from 'mute-structs'
import { Observable } from 'rxjs/Observable'
import { fromEventPattern } from 'rxjs/observable/fromEventPattern'
import { filter, map, share } from 'rxjs/operators'
import { Subscription } from 'rxjs/Subscription'
import { EditorService } from './editor.service'

import * as CodeMirror from 'codemirror'

@Component({
  selector: 'mute-editor',
  templateUrl: './editor.component.html',
  styleUrls: [
    // FIXME: Importing CodeMirror's CSS here doesn't work.
    // Should find a proper way to do it.
    './editor.component.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ EditorService ]
})

@Injectable()
export class EditorComponent implements OnChanges, OnDestroy, OnInit {

  private isInited = false

  private remoteOperationsSubscription: Subscription

  private textOperationsObservable: Observable<TextOperation[]>

  @Input() docService: DocService
  @Output() isReady: EventEmitter<any> = new EventEmitter()
  @ViewChild('editorElt') editorElt

  public editor: CodeMirror.Editor

  constructor (
    private zone: NgZone,
    private editorService: EditorService
  ) {}

  ngOnInit () {
    this.zone.runOutsideAngular(() => {
      this.editor = CodeMirror.fromTextArea(this.editorElt.nativeElement, this.editorService.editorConfiguration as any)
      this.editorService.initEditor(this.editor)

      const operationStream: Observable<ChangeEvent> = fromEventPattern(
        (h: ChangeEventHandler) => this.editor.on('change', h),
        (h: ChangeEventHandler) => this.editor.off('change', h),
        (instance, change) => new ChangeEvent(instance, change)
      )
        .pipe(
          filter((changeEvent: ChangeEvent) => {
            // The change's origin indicates the kind of changes performed
            // When the application updates the editor programatically, this field remains undefined
            // Allow to filter the changes performed by our application
            return changeEvent.change.origin !== 'muteRemoteOp' && changeEvent.change.origin !== 'setValue'
          })
        )

      const multipleOperationsStream: Observable<ChangeEvent[]> = operationStream
        .pipe(map((changeEvent) => [changeEvent]))
      /*
        .bufferTime(1000)
        .filter((changeEvents: ChangeEvent[]) => {
          // From time to time, the buffer returns an empty array
          // Allow to filter these cases
          return changeEvents.length > 0
        })
      */

      this.textOperationsObservable = multipleOperationsStream.pipe(
        map((changeEvents: ChangeEvent[]) => changeEvents
          .map((changeEvent: ChangeEvent) => changeEvent.toTextOperations())
          .reduce((acc, textOperations) => acc.concat(textOperations), [])
        ),
        share()
      )

      this.docService.localTextOperationsSource = this.textOperationsObservable

      this.isReady.next(undefined)
    })
  }

  ngOnChanges (): void {
    this.zone.runOutsideAngular(() => {
      if (this.isInited) {
        this.editor.setValue('')
        this.remoteOperationsSubscription.unsubscribe()
      }

      // First ngOnChanges is called before ngOnInit
      // This observable is not ready yet
      if (this.textOperationsObservable !== undefined) {
        this.docService.localTextOperationsSource = this.textOperationsObservable
      }

      this.remoteOperationsSubscription = this.docService.onRemoteTextOperations.subscribe( (textOperations: TextOperation[]) => {

        const updateDoc: () => void = () => {
          const doc: CodeMirror.Doc = this.editor.getDoc()

          // log.info('operation:editor', 'applied: ', textOperations)

          textOperations.forEach( (textOperation: TextOperation) => {
            const from: CodeMirror.Position = doc.posFromIndex(textOperation.offset)
            if (textOperation instanceof TextInsert) {
              doc.replaceRange(textOperation.content, from, undefined, 'muteRemoteOp')
            } else if (textOperation instanceof TextDelete) {
              const to: CodeMirror.Position = doc.posFromIndex(textOperation.offset + textOperation.length)
              doc.replaceRange('', from, to, 'muteRemoteOp')
            }
          })
        }

        this.editor.operation(updateDoc)
      })

      if (this.isInited) {
        this.isReady.next(undefined)
      } else {
        this.isInited = true
      }
    })
  }

  ngOnDestroy () {
    this.remoteOperationsSubscription.unsubscribe()
  }

  focus () {
    this.editor.focus()
  }

}

type ChangeEventHandler = (instance: CodeMirror.Editor, change: CodeMirror.EditorChange) => void

class ChangeEvent {
  instance: CodeMirror.Editor
  change: CodeMirror.EditorChange

  constructor (instance: CodeMirror.Editor, change: CodeMirror.EditorChange) {
    this.instance = instance
    this.change = change
  }

  toTextOperations (): TextOperation[] {
    const textOperations: TextOperation[] = []
    const pos: CodeMirror.Position = this.change.from
    const index: number = this.instance.getDoc().indexFromPos(pos)

    // Some changes should be translated into both a TextDelete and a TextInsert operations
    // It's especially the case when the changes replace a character
    if (this.isDeleteOperation()) {
      const length: number = this.change.removed.join('\n').length
      textOperations.push(new TextDelete(index, length))
    }
    if (this.isInsertOperation()) {
      const text: string = this.change.text.join('\n')
      textOperations.push(new TextInsert(index, text))
    }

    // log.info('operation:editor', 'generated: ', textOperations)
    return textOperations
  }

  isInsertOperation (): boolean {
    return this.change.text.length > 1 || this.change.text[0].length > 0
  }

  isDeleteOperation (): boolean {
    return this.change.removed.length > 1 || this.change.removed[0].length > 0
  }

}
