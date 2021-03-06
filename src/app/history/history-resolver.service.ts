import { Injectable } from '@angular/core'
import { MatSnackBar } from '@angular/material'
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router'

import { Doc } from '../core/Doc'
import { StorageService } from '../core/storage/storage.service'

@Injectable()
export class HistoryResolverService implements Resolve<Doc> {

  constructor (
    private router: Router,
    private storage: StorageService,
    private snackBar: MatSnackBar
  ) {}

  async resolve (route: ActivatedRouteSnapshot): Promise<Doc> {
    try {
      // Looking for a document
      const key = route.params['key']
      return this.storage.searchDoc(key)
        .then((docs: Doc[]) => {
          // FIXME: it's possible here to fetch a Folder with the provided key and thus need to treat this scenario
          if (docs.length !== 0) {
            // FIXME: maybe found several documents (in the future when folders are implemented)
            return docs[0]
          } else {
            throw new Error ('Document could not be found')
          }
        })
    } catch (err) {
      log.warn('Failed to open the document history.', err.message)
      this.snackBar.open(`Could not resolve the URL: ${err.message}`, 'close', {duration: 3000})
      this.router.navigateByUrl('/docs', {skipLocationChange: false})
      return undefined
    }
  }
}
