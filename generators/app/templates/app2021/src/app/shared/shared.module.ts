import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {CommonModule, NgStyle} from '@angular/common';
import {NgModule} from '@angular/core';
import {IonicModule} from 'ionic-angular';

import {
    FidjModule
} from "fidj";

import {Profile} from "./profile.service";
import {Storage} from "./storage.service";

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        IonicModule,
        FidjModule,
    ],
    providers: [
        Profile,
        Storage
    ],
    exports: [
        CommonModule,
        BrowserModule,
        BrowserAnimationsModule,
        IonicModule,
        FidjModule,
        NgStyle
    ]
})
export class SharedModule {
}
