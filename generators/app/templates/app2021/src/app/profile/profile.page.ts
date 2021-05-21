import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Base64, FidjService} from 'fidj';

@Component({
    selector: 'app-profile',
    templateUrl: 'profile.page.html',
    styleUrls: ['profile.page.scss']
})
export class ProfilePage {

    public profileUsername: string;

    constructor(
        private router: Router,
        private fidjService: FidjService) {

        this.refresh(null);
    }

    async refresh(event) {
        try {
            const idToken = await this.fidjService.getIdToken();
            const payload = idToken.split('.')[1];
            const payloadInfo = JSON.parse(Base64.decode(payload));
            console.log(typeof payloadInfo, payloadInfo.name);
            this.profileUsername = payloadInfo.name;
        } catch (e) {
            console.warn(e);
            this.profileUsername = null;
        }

        if (event) {
            event.target.complete();
        }
    }

    async logout() {
        await this.fidjService.logout();
        await this.router.navigateByUrl('/');
    }

}
