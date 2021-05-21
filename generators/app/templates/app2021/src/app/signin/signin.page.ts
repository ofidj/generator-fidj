import {Component, OnInit} from '@angular/core';
import {FidjService} from 'fidj';
import {Router} from '@angular/router';

@Component({
    selector: 'app-signin',
    templateUrl: 'signin.page.html',
    styleUrls: ['signin.page.scss']
})
export class SigninPage implements OnInit {

    userLoginEmail: any;
    userLoginPassword: any;
    asUser: boolean;
    loginError: string;

    constructor(
        private router: Router,
        private fidjService: FidjService
    ) {
        this.asUser = true;
    }

    ngOnInit() {
        if (this.fidjService.isLoggedIn()) {
            return this.router.navigateByUrl('/my');
        } else {
            console.log('not logged in');
        }
    }

    async login(email, pwd) {
        this.loginError = '';
        try {
            await this.fidjService.login(email, pwd);
            await this.router.navigateByUrl('/my');
        } catch (err) {
            this.loginError = 'Bad credentials';
            console.error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        }
    }

    async loginAsDemo() {
        try {
            await this.fidjService.loginAsDemo();
            await this.router.navigateByUrl('/my');
        } catch (e) {
            console.error(e);
        }
    }

    async profileChanged(event) {
        this.asUser = !this.asUser;
    }

    async forgot(email: string) {
        if (!email) {
            this.loginError = 'Please set your email in order to receive the new password.';
        }

        try {
            await this.fidjService.forgotPasswordRequest(email);
            this.loginError = '';
        } catch (e) {
            console.error(e);
        }
    }

}
