import {Component, OnInit} from '@angular/core';
//import {NavController} from 'ionic-angular';
//TODO import {FidjService} from "fidj";
//import {HomePage} from "../home/home";
//import {Profile} from "../../app/shared/profile.service";
//import {version} from "../../app/shared/version.const";
//import {Network} from "@ionic-native/network";
import {Subscription} from "rxjs";

@Component({
    selector: 'signin',
    templateUrl: 'signin.page.html'
})
export class SigninPage implements OnInit {

    //public appVersion = version;
    private connected : Subscription;
    userLoginEmail: any;
    userLoginPassword: any;
    appVersion: any;

    constructor(
        //public navCtrl: NavController,
          //      private network: Network,
            //    private profile: Profile,
            //TODO    private fidjService: FidjService
    ) {

    }

    ngOnInit() {

       // if (this.fidjService.isLoggedIn()) {
            //this.navCtrl.setRoot(HomePage);
       // }
        // this.connected = this.network.onConnect().subscribe(data => {
        //     console.log(data);
        //     if (this.fidjService.isLoggedIn()) {
        //         this.navCtrl.setRoot(HomePage);
        //     }
        // }, error => console.error(error));
    }

    ngOnDestroy() {
        // this.connected.unsubscribe();
    }

    login(email, pwd) {
        // this.profile.setEmail(email);
        // this.fidjService.login(email, pwd)
        //     .then(() => {
        //         this.navCtrl.setRoot(HomePage);
        //     })
        //     .catch(err => {
        //         alert(JSON.stringify(err));
        //         console.error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        //     });
    }

    loginAsDemo() {
        // this.profile.setEmail('demo user');
        // this.fidjService.loginAsDemo()
        //     .then(() => {
        //         this.navCtrl.setRoot(HomePage);
        //     })
        //     .catch(err => alert(JSON.stringify(err)));

    }

}
