import { Component } from '@angular/core';
import {Router} from '@angular/router';
import { FidjService } from 'fidj';

@Component({
  selector: 'app-my',
  templateUrl: 'my.page.html',
  styleUrls: ['my.page.scss']
})
export class MyPage {

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
