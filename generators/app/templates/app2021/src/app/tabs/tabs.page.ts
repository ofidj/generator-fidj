import { Component } from '@angular/core';
import {Router} from "@angular/router";
import { FidjService } from 'fidj';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss']
})
export class TabsPage {

  constructor(
      private router: Router,
      private fidjService: FidjService) {}


  ngOnInit() {
    if (this.fidjService.isLoggedIn()) {
    } else {
      console.log('not logged in');
      return this.router.navigateByUrl('/signin');
    }
  }

}
