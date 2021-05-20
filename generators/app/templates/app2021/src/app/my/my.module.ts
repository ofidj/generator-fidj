import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MyPageRoutingModule } from './my-routing.module';

import { MyPage } from './my.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    MyPageRoutingModule
  ],
  declarations: [MyPage]
})
export class MyPageModule {}
