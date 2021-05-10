const Generator = require('yeoman-generator');
const yosay = require('yosay');
const chalk = require('chalk');

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.hasBeenRecordedInFidjOvh = true;
    this.templateName = 'app2021'; //'app2021'; //'app2018' ''ionic2020'

    this.option('skip-welcome-message', {
      desc: 'Skips the welcome message',
      type: Boolean
    });

    this.argument('appname', {type: String, required: false, desc: 'Your app name'});
    this.argument('appType', {type: String, required: false, desc: 'For ex: "app2021" '});
    this.argument('appId', {type: String, required: false});
    this.argument('appOptions', {type: String, required: false});
    this.argument('appUserName', {type: String, required: false});
    this.argument('appDescription', {type: String, required: false});
    this.argument('appWelcome', {type: String, required: false});
    this.argument('appContent', {type: String, required: false});
  }

  async initializing() {
    this.pkg = require('../../package.json');
  }

  async prompting() {
    if (!this.options['skip-welcome-message'] && !this.options.appId) {
      this.log(yosay('\'Allo \'Welcome to ' + chalk.red('fidj.ovh') + ' generator'));

      const promptConditions = [{
        type: 'confirm',
        name: 'hasBeenRecordedInFidjOvh',
        message: 'Did you recorded your app in fidj.ovh and received your appId ?',
        default: false
      }];

      const conditions = await this.prompt(promptConditions);
      this.hasBeenRecordedInFidjOvh = !!conditions.hasBeenRecordedInFidjOvh;
      if (!this.hasBeenRecordedInFidjOvh) {
        const err = 'You need to submit your app on https://fidj.ovh first. ' +
          'It will help you to build a valid app name and give you a appId.';
        this.log(yosay('Sorry : ' + chalk.red(err) + ' See you in 2 minutes ?'));
      }
    }

    if (!this.options.appname || !this.options.appUserName || !this.options.appDescription) {
      const prompts = [
        {
          type: 'input',
          name: 'appUserName',
          message: 'Your (github) user name'
        },
        {
          type: 'input',
          name: 'appName',
          message: 'Your app name (as shown on device)',
          default: this.appname.replace(/[^\w\s]/gi, '').replace(/\s/g, '_').replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase()
        },
        {
          type: 'input',
          name: 'appDescription',
          message: 'App description',
          default: this.appname
        }
      ];

      this.props = await this.prompt(prompts);
    } else {
      this.props = {
        appName: this.options.appname,
        appUserName: this.options.appUserName,
        appDescription: this.options.appDescription,
        appWelcome: this.options.appWelcome || '<h1>Welcome</h1>',
        appContent: this.options.appContent || '<h1>Hello</h1>'
      };
    }

    const pack = this.props.appUserName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase();
    const age = this.props.appName.replace(/[^\w\s]/gi, '').replace(/\s/g, '_').replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase();
    const packageDefault = 'ovh.' + (pack ? pack : 'fidj') + '.' + age;

    if (!this.options.appId) {
      const prompts02 = [{
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

      this.props02 = await this.prompt(prompts02);
    } else {
      this.props02 = {
        appId: this.options.appId,
        appPackage: packageDefault,
        appHomepage: 'https://fidj.ovh/_/' + age
      };
    }
  }

  async writing() {
    if (!this.hasBeenRecordedInFidjOvh) {
      return;
    }

    let copyAll = true;
    if (this.options.appType === 'app2018') {
      this.templateName = 'app2018';
    } else {
      this.templateName = 'app2021';
    }

    const now = new Date();
    const version = '' + ('' + now.getFullYear()).substr(2) + '.' + (now.getMonth() + 1) + '.' + now.getDate();

    const appArguments = {
      appName: this.props.appName,
      appNameStrict: this.props.appName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '').replace(/[\. ,:-]+/g, '').toLowerCase(),
      appDescription: this.props.appDescription,
      appWelcome: this.props.appWelcome,
      appContent: this.props.appContent,
      appUserName: this.props.appUserName,
      appHomepage: this.props02.appHomepage,
      appPackage: this.props02.appPackage,
      appId: this.props02.appId,
      appOptions: this.options.appOptions ? ', {' + this.options.appOptions + '}' : '',
      appVersion: version,
      appKeywords: 'fidj',
      appYear: now.getFullYear(),
      appColor: 'white'
    };

    this.fs.copyTpl(
      this.templatePath(this.templateName + '/*'),
      this.destinationPath(),
      appArguments
    );

    this.fs.copyTpl(
      this.templatePath(this.templateName + '/.*'),
      this.destinationPath(),
      appArguments
    );

    this.fs.copyTpl(
      this.templatePath(this.templateName + '/src'),
      this.destinationPath('src'),
      appArguments
    );

    if (copyAll) {
      this.fs.copy(
        this.templatePath(this.templateName + '/platforms'),
        this.destinationPath('platforms')
      );

      this.fs.copy(
        this.templatePath(this.templateName + '/resources'),
        this.destinationPath('resources')
      );

      this.fs.copy(
        this.templatePath(this.templateName + '/tests'),
        this.destinationPath('tests')
      );

      //this.fs.copy(
      //  this.templatePath(this.templateName + '/www'),
      //  this.destinationPath('www')
      //);
    }
  }

  async install() {
    if (!this.hasBeenRecordedInFidjOvh) {
      return;
    }
    this.npmInstall();
  }

  async end() {

  }
};
