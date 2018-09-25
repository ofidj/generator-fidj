'use strict';
const Generator = require('yeoman-generator');
const commandExists = require('command-exists').sync;
const yosay = require('yosay');
const chalk = require('chalk');
//const wiredep = require('wiredep');
const mkdirp = require('mkdirp');
// const _s = require('underscore.string');

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.option('skip-welcome-message', {
      desc: 'Skips the welcome message',
      type: Boolean
    });

    this.option('skip-install-message', {
      desc: 'Skips the message after the installation of dependencies',
      type: Boolean
    });

    this.option('test-framework', {
      desc: 'Test framework to be invoked',
      type: String,
      defaults: 'mocha'
    });

    this.option('babel', {
      desc: 'Use Babel',
      type: Boolean,
      defaults: true
    });
  }

  initializing() {
    this.pkg = require('../../package.json');
    // this.composeWith(
    //   require.resolve(`generator-${this.options['test-framework']}/generators/app`), {
    //     'skip-install': this.options['skip-install']
    //   }
    // );
  }

  prompting() {
    if (!this.options['skip-welcome-message']) {
      this.log(yosay('\'Allo \'Welcome to ' + chalk.red('fidj.ovh') + ' generator'));
    }

    var promptConditions = [{
      type: 'confirm',
      name: 'hasBeenRecordedInFidjOvh',
      message: 'Did you recorded your app in fidj.ovh and received your appId ?',
      default: false
    }];

    var prompts = [
      // {
      //   type: 'input',
      //   name: 'appType',
      //   message: 'Technologies : angular, (soon)angular2 ',
      //   choices: ['angular'],
      //   default: 'angular'
      // },
      {
        type: 'input',
        name: 'appUserName',
        message: 'Your (github) user name'
      },
      {
        type: 'input',
        name: 'appName',
        message: 'Your app name (as shown on device)',
        default: this.appname.replace(/[^\w\s]/gi, '').replace(/\s/g, "_").replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase()
      },
      {
        type: 'input',
        name: 'appDescription',
        message: 'App description',
        default: this.appname
      }
    ];

    var self = this;
    return self
      .prompt(promptConditions)
      .then(function (conditions) {

        self.conditions = conditions;
        if (!self.conditions.hasBeenRecordedInFidjOvh) {
          return Promise.reject('You need to submit your app on https://fidj.ovh first. ' +
            'It will help you to build a valid app name and give you a appId.');
        }

        return self.prompt(prompts);
      })
      .then(function (props) {
        self.props = props;

        var pack = self.props.appUserName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase();
        var age = self.props.appName.replace(/[^\w\s]/gi, '').replace(/\s/g, "_").replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase();
        var packageDefault = 'ovh.' + (pack ? pack : 'fidj') + '.' + age;

        //todo based onUserName / appName : package, homepage
        var prompts02 = [{
            type: 'input',
            name: 'appId',
            message: 'Your app Id'
          },
          {
            type: 'input',
            name: 'appPackage',
            message: 'Your app package name',
            default: packageDefault
          },
          {
            type: 'input',
            name: 'appHomepage',
            message: 'Home page url',
            default: 'https://fidj.ovh/_/' + age
          }
        ];

        return self.prompt(prompts02);
      })
      .then(function (props02) {
        self.props02 = props02;
      })
      .catch(function (err) {
        self.log(yosay('Sorry : ' + chalk.red(err) + ' See you in 2 minutes ?'));
      });
  }

  writing() {
    var self = this;
    if (!self.conditions.hasBeenRecordedInFidjOvh) return;

    var now = new Date();
    var version = '' + ('' + now.getFullYear()).substr(2) + '.' + (now.getMonth() + 1) + '.' + now.getDate();

    var appArguments = {
      appName: self.props.appName,
      appNameStrict: self.props.appName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase(),
      appDescription: (self.props.appDescription),
      appUserName: (self.props.appUserName),
      appHomepage: (self.props02.appHomepage),
      appPackage: (self.props02.appPackage),
      appId: self.props02.appId,
      appVersion: version,
      appKeywords: 'mobile angular fidj', //self.props02.appKeywords,
      appYear: now.getFullYear(), //self.props02.appYear,
      appColor: 'white' //self.props02.appColor
    };

    //if (this.props.appType === 'angular') {

    // Copy all non-dotfiles
    this.fs.copyTpl(
      this.templatePath('agile-pokr/*'),
      this.destinationPath(),
      appArguments
    );
    this.fs.copyTpl(
      this.templatePath('agile-pokr/.*'),
      this.destinationPath(),
      appArguments
    );

    this.fs.copyTpl(
      this.templatePath('agile-pokr/src'),
      this.destinationPath('src'),
      appArguments
    );

    // Not templated
    //mkdirp('hooks');
    //mkdirp('platforms');
    //mkdirp('resources');
    //mkdirp('scss');
    //mkdirp('www');

    console.log('this.templatePath() : ', this.templatePath());
    console.log('this.destinationPath() : ', this.destinationPath());
    // this.fs.copy(
    //   this.templatePath('agile-pokr/hooks'),
    //   this.destinationPath('hooks')
    // );
    this.fs.copy(
      this.templatePath('agile-pokr/platforms'),
      this.destinationPath('platforms')
    );
    this.fs.copy(
      this.templatePath('agile-pokr/resources'),
      this.destinationPath('resources')
    );
    // this.fs.copy(
    //   this.templatePath('agile-pokr/scss'),
    //   this.destinationPath('scss')
    // );
    this.fs.copy(
      this.templatePath('agile-pokr/tests'),
      this.destinationPath('tests')
    );
    // this.fs.copy(
    //   this.templatePath('aio1/www/js/config/.gitignore'),
    //   this.destinationPath('www/js/config/.gitignore')
    // );

    // this.fs.move('agile-pokr/tests/dot.gitignore', 'agile-pokr/tests/.gitignore');


    //}
    //this.mkdir('helpers')
    //this.mkdir('www')
  }


  install() {
    var self = this;
    if (!self.conditions.hasBeenRecordedInFidjOvh) return;
    this.installDependencies();

  }

  end() {

  }
};
