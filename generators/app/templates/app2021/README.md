# <%= appName %>

> <%= appDescription %>

## Prerequisite

Look at [mat's gist](https://gist.github.com/mlefree/2156f66dfb441f107bef157dde56a836),
in order to check your node, cordova, ionic and yeoman installation.

[![Fidj.ovh Status][fidj-image]][fidj-url]
[![Build Status][travis-image]][travis-url]

## Build it

Clone and install the project

```bash
npm install
```

and then launch on your device

```bash
npm run ios
# then ready to launch your app (./platforms/ios/*.xcodeproj) in XCode
```

## Deploy

Follow this https://ionicframework.com/docs/intro/deploying.

### For test on Github or Heroku

It's up to you if you want to use your www generated folder as static page.You can also use the [fidj-sandbox](https://sss) before any production; 2 variables are available for that :

```bash
FIDJ_APP_ID # force your fidj app Id with your sandbox's one
FIDJ_APP_PROD # 'true' by default, 'false' to test it on sandbox
```

[fidj-image]: https://fidj.ovh/_/<%= appName %>/badges/github.svg
[fidj-url]: https://fidj.ovh/_/<%= appName %>
[travis-image]: https://travis-ci.org/<%=appUserName %>/<%= appName %>.svg?branch=master
[travis-url]: https://travis-ci.org/<%=appUserName %>/<%= appName %>

