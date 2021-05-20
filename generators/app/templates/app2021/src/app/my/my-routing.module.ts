import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MyPage } from './my.page';

const routes: Routes = [
  {
    path: '',
    component: MyPage,
    children: [
      {
        path: 'content',
        loadChildren: () => import('../content/content.module').then(m => m.ContentPageModule)
      },
      {
        path: 'profile',
        loadChildren: () => import('../profile/profile.module').then(m => m.ProfilePageModule)
      },
      {
        path: '',
        redirectTo: '/my/content',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/my/content',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MyPageRoutingModule {}
