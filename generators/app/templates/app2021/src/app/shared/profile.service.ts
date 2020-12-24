import {Injectable} from "@angular/core";
import {Storage} from "./storage.service";
// import {Observable} from "rxjs/Observable";
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {Observable} from "rxjs/Observable";

@Injectable()
export class Profile {

    private email: string;
    private roles : Array<string>;
    public readyForSync: BehaviorSubject<boolean>;

    constructor(private _storage: Storage) {
        console.log('Profile service');
        this.email = this._storage.get('email') || null;
        this.readyForSync = new BehaviorSubject<boolean>(false);
        this.roles = [];
    }

    getEmail() {
        return this.email;
    }

    setEmail(email: string) {
        this.email = email;
        this._storage.set('email', this.email);
    }

    logout() {
        this._storage.remove('email');
    }

    isReady() : Observable<boolean> {
        return this.readyForSync.asObservable();
    }

    getRoles() : Array<string> {
        return this.roles;
    }

    setRoles(roles : Array<string> ) : void {
        this.roles = roles;
    }
}

