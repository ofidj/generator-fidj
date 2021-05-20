import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContentPage } from './content.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { ContentPageRoutingModule } from './content-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    ContentPageRoutingModule
  ],
  declarations: [ContentPage]
})
export class ContentPageModule {}
