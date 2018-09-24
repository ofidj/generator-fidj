import {Component} from '@angular/core';
import {NavController, NavParams} from 'ionic-angular';
import {FidjService} from "fidj";
import {LoginPage} from "../login/login";
import {Profile} from "../../app/shared/profile.service";
import {version} from "../../app/shared/version.const";

@Component({
    selector: 'page-profile',
    templateUrl: 'profile.html'
})
export class ProfilePage {

    public appVersion = version;

    constructor(public navCtrl: NavController,
                public navParams: NavParams,
                public profile: Profile,
                private fidjService: FidjService) {

    }

    logout() {
        this.fidjService.logout()
            .then(() => {
                this.profile.logout();
                this.navCtrl.setRoot(LoginPage);
            })
            .catch(err => {
                alert(JSON.stringify(err));
                this.profile.logout();
                this.navCtrl.setRoot(LoginPage);
            });
    }

}
