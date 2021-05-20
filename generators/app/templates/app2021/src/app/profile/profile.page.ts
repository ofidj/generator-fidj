import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {EndpointInterface, FidjService} from 'fidj';

@Component({
    selector: 'app-profile',
    templateUrl: 'profile.page.html',
    styleUrls: ['profile.page.scss']
})
export class ProfilePage {

    public profileEmail: string;
    public profileMobile: string;
    public profileName: string;
    public profilePassword: string;
    public profileAppsOwned: string[];
    public profileAppsSubscribed: string[];

    public appEndpoints: EndpointInterface[] = [];

    public me: any;

    constructor(
        private router: Router,
        private fidjService: FidjService) {

        this.refresh(null);
    }

    async refresh(event) {
        try {
            this.appEndpoints = await this.fidjService.getEndpoints();
            this.me = await this.fidjService.sendOnEndpoint({verb: 'GET', key: 'me', relativePath: 'details'});
            this.profileName = this.me.user.name;
            this.profileEmail = this.me.user.poc.email;
            this.profileMobile = this.me.user.poc.mobile;
            this.profileAppsOwned = this.me.user.appsOwned ? this.me.user.appsOwned : [];
            this.profileAppsSubscribed = this.me.user.appsSubscribed ? this.me.user.appsSubscribed : [];
        } catch (e) {
            this.me = null;
        }
        if (event) {
            event.target.complete();
        }
    }

    async logout() {
        await this.fidjService.logout();
        await this.router.navigateByUrl('/');
    }

    async putChanges() {
        const data: any = {};
        if (this.profileName !== this.me.name) {
            data.name = this.profileName;
        }
        if (this.profilePassword) {
            data.password = this.profilePassword;
        }

        await this.fidjService.sendOnEndpoint({key: 'me', verb: 'PUT', data});
    }

}
