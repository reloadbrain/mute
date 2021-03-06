import {
  animate,
  state,
  style,
  transition,
  trigger
} from '@angular/animations'
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core'
import { SignalingState, WebGroupState } from 'netflux'
import { Subscription } from 'rxjs/Subscription'

import { NetworkService } from '../../../doc/network/network.service'

@Component({
  selector: 'mute-sync',
  templateUrl: './sync.component.html',
  styleUrls: ['./sync.component.scss'],
  animations: [
    trigger('cardState', [
      state('visible', style({
        opacity: '1'
      })),
      transition('void => visible', animate('150ms ease-out')),
      transition('visible => void', animate('150ms ease-in'))
    ])
  ]
})
export class SyncComponent implements OnInit, OnDestroy {

  private subs: Subscription[]

  public SYNC = 1
  public SYNC_DISABLED = 2

  public syncState: number
  public cardState: string
  public signalingDetails: string
  public groupDetails: string

  constructor (
    private changeDetectorRef: ChangeDetectorRef,
    private networkService: NetworkService
  ) {
    this.subs = []
    this.groupDetails = ''
    this.signalingDetails = ''
  }

  ngOnInit () {
    this.subs[this.subs.length] = this.networkService.onStateChange
      .subscribe((s: WebGroupState) => {
        switch (s) {
        case WebGroupState.JOINING:
          this.groupDetails = 'Joining the group...'
          this.syncState = undefined
          break
        case WebGroupState.JOINED:
          this.groupDetails = 'Successfully joined the group.'
          this.syncState = this.SYNC
          break
        case WebGroupState.LEAVING:
          this.groupDetails = 'Leaving the group...'
          this.syncState = this.SYNC_DISABLED
          break
        case WebGroupState.LEFT:
          this.groupDetails = 'Left the group.'
          this.syncState = this.SYNC_DISABLED
          break
        default:
          this.groupDetails = 'undefined'
          this.syncState = undefined
        }
        this.changeDetectorRef.detectChanges()
      })

    this.subs[this.subs.length] = this.networkService.onSignalingStateChange
      .subscribe((s: SignalingState) => {
        switch (s) {
        case SignalingState.CONNECTING:
          this.signalingDetails = 'Connecting to the signaling server...'
          break
        case SignalingState.CONNECTED:
          this.signalingDetails = 'Successfully connected to one group member.'
          break
        case SignalingState.STABLE:
          this.signalingDetails = 'Connection with signaling server is stable.'
          break
        case SignalingState.CLOSING:
          this.signalingDetails = 'Closing connection with the signaling server.'
          break
        case SignalingState.CLOSED:
          this.signalingDetails = 'No longer connected to the signaling server.'
          break
        default:
          this.signalingDetails = 'undefined'
        }
        this.changeDetectorRef.detectChanges()
      })
  }

  ngOnDestroy () {
    this.subs.forEach((s: Subscription) => s.unsubscribe())
  }

  showCard () {
    this.cardState = 'visible'
  }

  hideCard () {
    this.cardState = 'void'
  }

}
