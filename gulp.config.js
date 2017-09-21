module.exports = function () {
    var client = './src/client/';
    var clientApp = client + 'app/';
    var server = './src/server/';
    var temp = './.tmp/';
    var root = './';
    var report = './report';
    var wiredep = require('wiredep');
    var bowerFiles = wiredep({devDependencies: true})['js'];

    var config = {

        // file paths
        
        client: client,
        build: './build/',
        fonts: './bower_components/font-awesome/fonts/**/*.*',
        htmltemplates: clientApp + '**/*500.html',
        images: client + 'images/**/*.*',
        alljs: ['./src/**/*.js', './*.js'],
        less: client + '/styles/styles.less',
        index: client + 'index.html',
        html: clientApp + '**/*.html',
        css: temp + 'styles.css',
        js: [
            clientApp + '**/*.module.js',
            clientApp + '**/*.js',
            '!' + clientApp + '**.spec.js'
        ],
        temp: temp,
        server: server,
        report: report,
        
        // bower and npm locations
        bower: {
            json: require('./bower.json'),
            directory: './bower_components/',
            ignorePath: '../..'
        },

        packages: [
            './package.json',
            './bower.json'
        ],

        root: root,
        
        // node settings
        defaultPort: 7203,
        nodeServer: './src/server/app.js',
        
        // reload delay
        browserReloadDelay: 1000,

        // karma and testing settings
        specHelpers: [client + 'test-helpers/*.js'],
        serverIntegrationSpecs: [client+'tests/server-integration/**/*.spec.js'],


        // template cache
        templateCache: {
            file: 'templates.js',
            options: {
                module: 'app.core',
                standAlone: false,
                root: 'app/'
            }

        }
    };
    
    config.getWiredepDefaultOptions = function () {
        var options = {
            bowerJson: config.bower.json,
            directory: config.bower.directory,
            ignorePath: config.bower.ignorePath
        };
    
        return options;
    };

    config.karma = getKarmaOptions();

    function getKarmaOptions() {
        var options = {
            files: [].concat(
                bowerFiles, 
                config.specHelpers, 
                client + '**/*.module.js',
                temp + config.templateCache.file,
                config.serverIntegrationSpecs
                ),
            exclude: [],
            coverage: {
                dir: report + 'coverage',
                reporters: [
                    {type: 'html', subdir: 'report-html'},
                    {type: 'lcov', subdir: 'report-lcov'},
                    {type: 'text-summary'}
                ]
            },
            preprocessors: {}
        };

        options.preprocessors[clientApp + '**/!(*.spec)+(.js)'] = ['coverage'];

        return options;
    }
    
    return config;
};
