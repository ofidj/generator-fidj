import {Component} from '@angular/core';
//import {LoadingController, NavController, NavParams} from 'ionic-angular';
import {FidjService} from "fidj";
//import {LoginPage} from "../login/login";
//import {Profile} from "../../app/shared/profile.service";
//import {version} from "../../app/shared/version.const";
import {EndpointInterface, ErrorInterface} from "fidj/sdk/interfaces";

@Component({
    selector: 'page-profile',
    templateUrl: 'profile.html'
})
export class ProfilePage {

    //public appVersion = version;
    public endpointResult: string;

    constructor(
        //public navCtrl: NavController,
          //      public navParams: NavParams,
            //    public loadingCtrl: LoadingController,
             //   public profile: Profile,
                private fidjService: FidjService) {

    }

    logout() {
        // this.fidjService.logout()
        //     .then(() => {
        //         this.profile.logout();
        //         this.navCtrl.setRoot(LoginPage);
        //     })
        //     .catch(err => {
        //         alert(JSON.stringify(err));
        //         this.profile.logout();
        //         this.navCtrl.setRoot(LoginPage);
        //     });
    }

    callEndpoint(endpoint: EndpointInterface) {


        // const loader = this.loadingCtrl.create({
        //     content: "Please wait...",
        //     // duration: 3000
        // });
        // loader.present();
        //
        // const data = {data: this.profile.getDataToShare()};
        // this.fidjService.postOnEndpoint(endpoint.key, data)
        //     .then(result => {
        //         this.endpointResult = JSON.stringify(result);
        //         loader.dismissAll();
        //     })
        //     .catch((err: ErrorInterface) => {
        //         loader.dismissAll();
        //         this.endpointResult = 'Error : ' + err.code + ' - ' + err.reason;
        //     });
    }

}
