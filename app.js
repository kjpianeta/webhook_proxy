var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var util = require('util');
var github = require('octonode');
var request = require('request');

var ciGithubUser = (process.env.githubuser || 'welgit-gen');
var ciGithubUserAuthToken = (process.env.cigithubuserauthtoken || 'ebc6fd3fd8ad03e2271599bfe6d52f2094ba1b50');
var ciGithubAuthorizedBranches = ['master'];
var goAdminUserName = (process.env.goadminusername || 'admin');
var goAdminUsePassword = (process.env.goadminusepassword || 'cisco123');
var goServerHostName = (process.env.goserverhostname || '10.90.166.114');
var goServerHostPort = (process.env.goserverhostport || '8153');
var goApiUrl = util.format("http://%s:%s@%s:%s/go/api/pipelines", goAdminUserName, goAdminUsePassword, goServerHostName, goServerHostPort);
var goPipelineBaseUrl = util.format("http://%s:%s/go/tab/pipeline/history/", goServerHostName, goServerHostPort);
var githubWebhookSecret = (process.env.githubwebhooksecret || '924f29a0fba0748b67856ce8f696987536495783');
var supportedActions = ['opened', 'synchronize', 'reopened'];
var goPipelinePool = ['openshift_webhook_container'];
// client.get('/user', {}, function (err, status, body, headers) {
//     console.log(body); //json object
// });

var GithubHook = require('./lib/github_hook');

var webhookHandler = GithubHook({path: '/webhook', secret: '924f29a0fba0748b67856ce8f696987536495783'});


var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(webhookHandler);

function triggerPullRequestMaterialPipeline(pull_number, pull_status_url, pull_html_url, pull_title, pull_author, pull_repo_url, pull_comments_url, pull_url) {
    var retries = 20;

    var requestOptions = {
        form: {data: {}},
        headers: {
            content_type: 'application/json',
            Confirm: true
        }
    };
    // console.info(util.format("pull_number: %s, pull_status_url: %s, pull_html_url: %s, pull_title: %s, pull_author: %s, pull_repo_url: %s, pull_comments_url: %s, pull_url: %s", pull_number, pull_status_url, pull_html_url, pull_title, pull_author, pull_repo_url, pull_comments_url, pull_url));
    console.info(util.format("requestOptions: %j ", requestOptions));
    var gocdPipelineSchedulePostBody = {
        variables: {},
        materials: {},
        secure_variables: {}
    };
    gocdPipelineSchedulePostBody.variables['pull_number'] = pull_number;
    gocdPipelineSchedulePostBody.variables['pull_status_url'] = pull_status_url;
    gocdPipelineSchedulePostBody.variables['pull_html_url'] = pull_html_url;
    gocdPipelineSchedulePostBody.variables['pull_title'] = pull_title;
    gocdPipelineSchedulePostBody.variables['pull_author'] = pull_author;
    gocdPipelineSchedulePostBody.variables['pull_repo_url'] = pull_repo_url;
    gocdPipelineSchedulePostBody.variables['pull_comments_url'] = pull_comments_url;
    gocdPipelineSchedulePostBody.variables['pull_url'] = pull_url;
    // console.info(util.format("gocdPipelineSchedulePostBody: %j ", gocdPipelineSchedulePostBody));
    var url = goApiUrl + '/openshift_webhook_container' + '/schedule';
    requestOptions.form.data = gocdPipelineSchedulePostBody;
    request.post(url, requestOptions, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body);
    });
}

webhookHandler.on('*', function (req, res, event, repo, data) {
    if (event == 'pull_request') {
        console.info("Pull request webhook event received.");
        var pull_number = data['pull_request']['number'];
        var pull_author = data['pull_request']['user']['login'];
        var pull_status_url = data['pull_request']['statuses_url'];
        var pull_html_url = data['pull_request']['html_url'];
        var pull_comments_url = data['pull_request']['comments_url'];
        var pull_url = data['pull_request']['url'];
        var pull_title = data['pull_request']['title'];
        var pull_repo_url = data['pull_request']['base']['repo']['clone_url'];
        var pull_branch = data['pull_request']['base']['ref'];
        var pull_mergeable = data['pull_request']['mergeable'];
        if (pull_mergeable == false) {
            res.status(200).json({error: 'PR is not mergeable'});
        }
        // Do nothing if PR is closed or not in array supportedActions
        if (supportedActions.indexOf(data['action']) > -1) {
            console.info(util.format("PR action %s triggers pipelines.", data['action']));
        } else {
            console.info(util.format("PR action %s does not trigger pipelines.", data['action']));
        }

        //Reject unathorized pull request

        //Kickoff GOCD Pipeline
        triggerPullRequestMaterialPipeline(pull_number,
            pull_status_url,
            pull_html_url,
            pull_title,
            pull_author,
            pull_repo_url,
            pull_comments_url,
            pull_url);
    }

    // var branchName = _s.strRightBack(ref, "/");
    // var fullNameRepository = data.repository.full_name;
    // var removedFilesArray = data["head_commit"]["removed"];
    // var addedFilesArray = data["head_commit"]["added"];
    // var modifiedFilesArray = data["head_commit"]["modified"];

    // console.info(util.format('Variables branchName: %s, fullNameRepository: %s, removedFilesArray: %s, addedFilesArray: %s, Data: %j ', branchName, fullNameRepository, addedFilesArray, data));

    var client = github.client({
        username: 'welgit-gen',
        password: 'password4Lusers!'
    }, {
        hostname: 'github3.cisco.com/api/v3'
    });
    var ghrepo = client.repo(data['name']);
    ghrepo.status(data['sha'], {
        "state": "success",
        "target_url": "http://ci.mycompany.com/job/hub/3",
        "description": "Build success."
    }, function () {
        console.info('Done');
    });
});

webhookHandler.on('event', function (repo, data) {
    console.info(util.format('This is the "event" event. Event:%j, Repo:%j, Data:%j', event, repo, data));
});

webhookHandler.on('reponame', function (event, data) {
    console.info(util.format('This is the "repo" event. Event:%j, Repo:%j, Data:%j', event, repo, data));
});

webhookHandler.on('error', function (err, req, res) {
    console.info(util.format('This is the "error" event. Event:%j, Repo:%j, Data:%j', event, repo, data));
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
