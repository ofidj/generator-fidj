# generator-fidj

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coverage percentage][codecov-image]][codecov-url]

> build great mobile angular/ionic apps based on fidj.ovh authentication.

## Prerequisite

TODO refresh :
Look at mat's gist : https://gist.github.com/mlefree/2156f66dfb441f107bef157dde56a836

## Installation

First, install [Yeoman](http://yeoman.io) and generator-fidj using [npm](https://www.npmjs.com/) (we assume you have pre-installed [node.js](https://nodejs.org/)) :
```bash
npm install -g yo
npm install -g @ionic/cli
npm install -g generator-fidj
```
Then generate your new project:
```bash
yo fidj
```
or as expert :
```bash
yo fidj TODO
```

## Development

Make sure you've got yeoman and bower installed :
```bash
npm install -g yo
```

Clone the repo, install it :
```bash
cd generator-fidj
npm install
npm link
yo name
```
And then use your local Fidj generator : 
```bash
mkdir your-app && cd your-app && \
   yo fidj my-app app2021 your-app-id me-as-user "my description" \
   "Welcome there" \
   "Hey<br>Heres my content: <img src=https://3.bp.blogspot.com/-vX0tnGUE4j4/V7xOTtIm6rI/AAAAAAAABKI/xvKjK_Mx0QoKd9Ew3EF_e70_JFr0VQJ7wCK4B/s920/Retro_Mario_in_3D_flavor_by_cezkid.gif /><br> \o/ " 

# look at the code : code .
# test app : npm start
```

## License

MIT 2021 © [fidj.ovh](fidj.ovh)

[npm-image]: https://badge.fury.io/js/generator-fidj.svg
[npm-url]: https://npmjs.org/package/generator-fidj
[travis-image]: https://travis-ci.org/fidj/generator-fidj.svg?branch=master
[travis-url]: https://travis-ci.org/fidj/generator-fidj
[daviddm-image]: https://david-dm.org/fidj/generator-fidj.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/fidj/generator-fidj
[coveralls-image]: https://coveralls.io/repos/fidj/generator-fidj/badge.svg
[coveralls-url]: https://coveralls.io/r/fidj/generator-fidj
[codecov-image]: https://codecov.io/gh/fidj/generator-fidj/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/fidj/generator-fidj
