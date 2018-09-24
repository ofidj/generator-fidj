import {Component} from '@angular/core';
import {NavController} from 'ionic-angular';
import {FidjService} from "fidj";

import {
    trigger,
    state,
    style,
    animate,
    transition
} from '@angular/animations';

import {Card} from "../../app/shared/card.model";
import {Profile} from "../../app/shared/profile.service";

@Component({
    selector: 'page-home',
    templateUrl: 'home.html',
    animations: [
        trigger('cardsState', [
            state('true', style({
                height: '100%',
                transform: 'scale(1)'
            })),
            state('false', style({
                height: '0%',
                transform: 'scale(0.1)'
            })),
            transition('true => false', animate('1000ms ease-in')),
            transition('false => true', animate('1ms ease-out'))
        ])
    ]
})
export class HomePage {

    // use one container for session
    private dataContainer: {
        cards: Array<Card>
    };

    // extract data for display
    public cards: Array<Card>;
    public cardSelected: number = 0;

    constructor(public navCtrl: NavController,
                public profile: Profile,
                private fidjService: FidjService) {
        this.cards = [];
        this.dataContainer = {
            cards: this.cards
        };

        this.profile.readyForSync.subscribe(
            (ready) => {
                if (ready === true && this.fidjService.isLoggedIn()) {
                    this.doRefresh();
                }
            },
            (err) => {
                console.error('Error: ' + err);
            },
            () => {
                console.log('Completed', this.cards);
            });
    }

    doRefresh(refresher?) {
        this.fidjService
            .sync(() => {
                let i0 = 0, i1 = 1;
                for (let i = 0; i < 12; i++) {
                    const i1_old = i1;
                    i1 = i1 + i0;
                    if (i0 === 1 && i1_old === 1) {
                        this.cards.push(new Card('?', []));
                    } else {
                        this.cards.push(new Card('' + i0, []));
                    }
                    i0 = i1_old;
                }
            })
            .then(() => {
                return this.fidjService.findAll();
            })
            .then((all: Array<any>) => {
                if (all.length) {
                    this.dataContainer = all[0];
                    this.cards = this.dataContainer.cards;
                    this.goUp();
                    console.log('this.cards', this.cards);
                }
                if (refresher) refresher.complete();
            })
            .catch(err => {
                alert(JSON.stringify(err));
                if (refresher) {
                    refresher.complete();
                }
            });
    }


    cardTapped($event, $index, card: Card) {
        this.cardSelected = $index + 1;
        if (!$index) this.cardSelected = this.cards.indexOf(card) + 1;
    }


    goUp() {
        this.cardSelected = 0;
    }

    add(cardS, story) {
        const selectedCard = this.cards[cardS - 1];
        selectedCard.comments.push(story);
        console.log(this.dataContainer);
        this.fidjService.put(this.dataContainer);
    }

    remove(cardS, index) {
        const selectedCard = this.cards[cardS - 1];
        selectedCard.comments.splice(index, 1);
        this.fidjService.put(this.dataContainer);
    }

}
