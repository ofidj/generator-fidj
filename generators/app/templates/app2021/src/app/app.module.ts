import {ErrorHandler, NgModule} from '@angular/core';
import {IonicApp, IonicErrorHandler, IonicModule, Refresher} from 'ionic-angular';
import {StatusBar} from '@ionic-native/status-bar';
import {Network} from "@ionic-native/network";
import {SplashScreen} from '@ionic-native/splash-screen';

import {MyApp} from './app.component';
import {HomePage} from '../pages/home/home';
import {SharedModule} from "./shared/shared.module";
import {ProfilePage} from "../pages/profile/profile";
import {LoginPage} from "../pages/login/login";

@NgModule({
    declarations: [
        MyApp,
        HomePage,
        ProfilePage,
        LoginPage
    ],
    imports: [
        SharedModule,
        IonicModule.forRoot(MyApp)
    ],
    bootstrap: [IonicApp],
    entryComponents: [
        MyApp,
        HomePage,
        ProfilePage,
        LoginPage
    ],
    providers: [
        StatusBar,
        SplashScreen,
        Network,
        Refresher,
        {provide: ErrorHandler, useClass: IonicErrorHandler}
    ]
})
export class AppModule {
}
