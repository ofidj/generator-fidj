import { Component } from '@angular/core';
import {Router} from "@angular/router";
import { FidjService } from 'fidj';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page {

  constructor(
      private router: Router,
      private fidjService: FidjService) {}

}
