import {Component, OnInit} from '@angular/core';
import {NavController} from 'ionic-angular';
import {FidjService} from "fidj";
import {HomePage} from "../home/home";
import {Profile} from "../../app/shared/profile.service";
import {version} from "../../app/shared/version.const";
import {Network} from "@ionic-native/network";
import {Subscription} from "rxjs/Subscription";

@Component({
    selector: 'page-login',
    templateUrl: 'login.html'
})
export class LoginPage implements OnInit {

    public appVersion = version;
    private connected : Subscription;

    constructor(public navCtrl: NavController,
                private network: Network,
                private profile: Profile,
                private fidjService: FidjService) {

    }

    ngOnInit() {

        if (this.fidjService.isLoggedIn()) {
            this.navCtrl.setRoot(HomePage);
        }
        this.connected = this.network.onConnect().subscribe(data => {
            console.log(data);
            if (this.fidjService.isLoggedIn()) {
                this.navCtrl.setRoot(HomePage);
            }
        }, error => console.error(error));
    }

    login(email, pwd) {
        this.profile.setEmail(email);
        this.fidjService.login(email, pwd)
            .then(() => {
                this.profile.setRoles(this.fidjService.getRoles());
                this.navCtrl.setRoot(HomePage);
            })
            .catch(err => alert(JSON.stringify(err)));
    }

    loginAsDemo() {
        this.profile.setEmail('demo user');
        this.fidjService.loginAsDemo()
            .then(() => {
                this.navCtrl.setRoot(HomePage);
            })
            .catch(err => alert(JSON.stringify(err)));

    }

}
