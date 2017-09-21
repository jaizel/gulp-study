/* ignore double quotes */
/* jshint -W109 */

var gulp = require("gulp");
var args = require("yargs").argv;

var $ = require("gulp-load-plugins")({lazy: true});

/* 
// These plugins no longer require their own require statement 
// since we are using the magic gulp-load-plugins

var jshint = require("gulp-jshint");
var jscs = require("gulp-jscs");
var util = require("gulp-util");
var gulpprint = require("gulp-print");
var gulpif = require("gulp-if");
*/

// load all configuration
var config = require("./gulp.config")();

// delete files
var del = require("del");

// setup port
var port = process.env.PORT || config.defaultPort;

// setup browser sync
var browserSync = require("browser-sync");

gulp.task("help", function () {
    $.taskListing();
});

gulp.task("default", ["help"]);

gulp.task("fonts", ["clean-fonts"], function() {
    log("Copying fonts...");
    return gulp.src(config.fonts)
        .pipe(gulp.dest(config.build + "fonts"));
});

gulp.task("images", ["clean-images"], function() {
    log("Copying and optimizing images...");
    return gulp.src(config.images)
        .pipe($.imagemin({optimizationLevel: 4}))
        .pipe(gulp.dest(config.build + "images"));
});

gulp.task("clean", function (done) {
    // use concat here instead of push because concat doesn't care if it's
    // a string or an object. push will only push objects
    var delconfig = [].concat(config.build, config.temp);
    log ("Cleaning: " + $.util.colors.red(delconfig));
    del(delconfig);
    done();
});


gulp.task("clean-fonts", function (done) {
    clean(config.build+'fonts/**/*.*', done);
});


gulp.task("clean-images", function (done) {
    clean(config.build+'images/**/*.*', done);
});

gulp.task("clean-code", function (done) {
    var files = [].concat(config.temp + "**/*.js", config.build + "**/*.js", config.build + "js/**/*.js");
    clean(files, done);
});

gulp.task("templatecache", ["clean-code"], function() {
    log("Creating AngularJS $templateCache...");
    return gulp
        .src(config.htmltemplates)
        .pipe($.minifyHtml( {empty: true}))
        .pipe($.angularTemplatecache(config.templateCache.file, config.templateCache.options))
        .pipe(gulp.dest(config.temp));

});

gulp.task("vet", function () {
    log("Analyzing source files with JSHint and JSCS...");
    return gulp
        .src(config.alljs)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jscs())
        .pipe($.jshint())
        .pipe($.jshint.reporter("jshint-stylish", { verbose: true }))
        .pipe($.jshint.reporter("fail"));
});

gulp.task("styles", [ "clean-styles" ], function () {
    log("Compiling Less --> CSS and using autoprefixer...");
    return gulp
        .src(config.less)
        .pipe($.plumber())
        .pipe($.less())
        .pipe($.autoprefixer( {browsers: ["last 2 version", "> 5%"]}))
        .pipe(gulp.dest(config.temp));
});

// callback done here is necessary because the clean-styles calls a clean function
// we don't know when that will end so we need a callback when everything is done

gulp.task("clean-styles", function (done) {
    var files = config.temp + "**/*.css";
    clean(files, done);
});

function clean(path, done) {
    log("Deleting files: " + path);
    del(path);
    
    // call the callback otherwise styles wouldn't know if clean-styles is already done
    // if we don't do this, styles task will not proceed after clean-styles has executed
    done();
}

gulp.task("less-watcher", function () { 
    log("Now watching for LESS document changes...");
    gulp.watch( [config.less], ["styles"]);
});

gulp.task("wiredep", function () {
    var options = config.getWiredepDefaultOptions();
    var wiredep = require("wiredep").stream;
    log("Wiring bower client dependencies and injecting JS dependencies...");
    
    return gulp
        .src(config.index)
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js)))
        .pipe(gulp.dest(config.client));
});

gulp.task("inject", ["wiredep", "styles", "templatecache"], function () {    
    log("Wiring local css...");
    
    return gulp
        .src(config.index) 
        .pipe($.print())
        .pipe($.inject(gulp.src(config.css)))
        .pipe(gulp.dest(config.client));
});

gulp.task("optimize", ["inject", "fonts", "images"], function() {
    log("Optimizing the javascript, css, html...");
    var templateCache = config.temp + config.templateCache.file;
    var cssFilter = $.filter('**/*.css', {restore: true});
    var assets = $.useref({searchPath: './'});
    var jsLibFilter = $.filter('**/lib.js', {restore: true});    
    var jsAppFilter = $.filter('**/app.js', {restore: true});
    var notIndexFilter = $.filter(['**/*', '!**/index.html'], {restore: true});

    return gulp
        .src(config.index)
        .pipe($.plumber())
        // insert templates.js from the templatecache task to our index.html (build)
        .pipe($.inject(gulp.src(templateCache, {read:false}), {
            starttag: '<!-- inject:templates:js -->'
        }))


        // get all assets from index.html, basically everything css and js
        // note: useref v3 is different from John Papa's tutorial
        // now we only need one useref pipe to do everything -- no more assets, restore, etc.
    
        .pipe(assets)

        // now just with all the css
        .pipe(cssFilter)
        // minify using csso
        .pipe($.csso())
        // now end the filter by calling restore 
        .pipe(cssFilter.restore)

        // now just with all the lib js
        .pipe(jsLibFilter)
        // minify using uglify
        .pipe($.uglify())
        // now end the filter by calling restore 
        .pipe(jsLibFilter.restore)

        // now just with all the app js
        .pipe(jsAppFilter)
        // before mangling, ngAnnotate first to protect angular functions and variables
        .pipe($.ngAnnotate())
        // minify using uglify
        .pipe($.uglify())
        // now end the filter by calling restore 
        .pipe(jsAppFilter.restore)


        .pipe(notIndexFilter)
        // now change the filename to add a hash
        // this is done for cache-busting purposes
        // app.js will become something like app-1lkj123.js
        .pipe($.rev())
        .pipe(notIndexFilter.restore)

        // now, replace all intances of the file in the index.html so they point
        // to the new hashed filenames
        .pipe($.revReplace())

        // write the final output to the build folder
        .pipe(gulp.dest(config.build))

        // write a manifest
        .pipe($.rev.manifest())
        // also to the build folder
        .pipe(gulp.dest(config.build));

});


gulp.task("serve-build", ["optimize"], function () {
    serve(false);
});

gulp.task("serve-dev", ["vet", "inject"], function () {
    serve(true);
});

gulp.task("bump", function() {

    /*

    Bump the version
    --type=pre will bump the prerelease version *.*.*-x
    --type=patch or no flag will bump the patch version *.*.x
    --type=minor will bump the minor version *.x.*
    --type=major will bump the major version x.*.*
    --version=1.2.3 will bump to a specific version and ignore other flags

    */

    var msg = "Bumping versions";
    var type = args.type;
    var version = args.version;
    var options = {};

    if (version) {
        options.version = version;
        msg += ' to ' + version;
    } else {
        options.type = type;
        msg += ' for a ' + type;
    }

    log(msg);
    return gulp
        .src(config.packages)
        .pipe($.print())
        .pipe($.bump(options))
        .pipe(gulp.dest(config.root));

});

function serve(isDev) {
    
    var nodeOptions = {
        script: config.nodeServer,
        delayTime: 1,
        env: {
            'PORT': port,
            'NODE_ENV': isDev? 'dev' : 'build'
        },
        watch: [config.server]
    };
    
    log("Now starting the node server...");
    
    return $.nodemon(nodeOptions)
        .on("restart", ["vet", "inject"], function(ev) {
            log('*** nodemon restrated ***');
            log('files changed on restart:\n' + ev);
            setTimeout(function () {
                browserSync.notify("reloading now...");
                browserSync.reload({stream: false});
            }, config.browserReloadDelay);
        })
        .on("start", function() {
            log('*** nodemon started ***');
            startBrowserSync(isDev);
        })
        .on("crash", function() {
            log('*** nodemon crashed: script crashed for some reason ***');
        })
        .on("exit", function() {
            log('*** nodemon exited cleanly ***');
        });
}

function changeEvent(event) {
    var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

function startBrowserSync(isDev) {
    // check if it's already running

    if (args.nosync || browserSync.active) {
        return;
    }
    
    if (isDev) {
        gulp.watch([config.less], ['styles'])
            .on('change', function(event) {
                changeEvent(event);
            
        });
    } else {
        gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
            .on('change', function(event) {
                changeEvent(event);
            
        });
    }
    
    var options = {
        proxy: 'localhost:' + port,
        port: 3000,
        files: isDev? [
            config.client + '**/*.*',
            '!' + config.less,
            config.temp + '**/*.css'
        ] : [],
        ghostMode: {
            clicks: true,
            location: false,
            forms: true,
            scroll: true
        },
        injectChanges: true,
        logFileChanges: true,
        logLevel: 'debug',
        logPrefix: 'browser-sync',
        notify: true,
        reloadDelay: 0
    };
    
    log("Now starting browser sync...");
    browserSync(options);
}

function log(msg) {
    if(typeof(msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.green(msg));
    }
}