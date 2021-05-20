import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {EndpointInterface, FidjService} from 'fidj';

@Component({
    selector: 'app-content',
    templateUrl: 'content.page.html',
    styleUrls: ['content.page.scss']
})
export class ContentPage {

    constructor(
        private router: Router,
        private fidjService: FidjService) {

        this.refresh(null);
    }

    async refresh(event) {

        if (event) {
            event.target.complete();
        }
    }

}
