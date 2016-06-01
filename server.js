/**
 * JOGGL@./server.js
 * @author egupta
 * @description File to run the primary server.
 */


/**
 * START - Loading dependencies for the application
 */

/**
 * PATH - for reading system path
 */
var path = require('path');

/**
 * EXPRESS - framework for using node
 */
var express = require('express');

/**
 * HTTP - used for making HTTP request.
 */
var https = require('https');

/**
 * WINSTON - Logger for application
 */
var logger = require('winston');

/**
 * BODY-PARSER - to parse JSON return body
 */
var bodyParser = require('body-parser');

/**
 * FS - To use the file system
 */
var fs = require('fs');

/**
 * xml2js - to convert xml to json.
 */
var parser = require('xmldoc');

/**
 * END - Loading dependencies for the application
 */

/**
 * START - Initialization of dependencies for the application
 */

/**
 * APP - Loading application using express
 */
var app= express();

/**
 * Running a https server.
 */
var https_options = {
    key : fs.readFileSync('server.key'),
    cert : fs.readFileSync('server.crt')
}

/**
 * Running port for the application 
 */
var port = 8080;

/**
 * Loading mysql db connection configurations
 * @param mysql
 */
var connection = require('./config/connections')();

/**
 * Getting the parser to convert xml to json
 * @param none
 */
//var parser = new xml2js.Parser();

/**
 * Loading the logger configurations
 * @param logger
 */
require('./config/logConnection')(logger);


//Serve static files
//app.set('view options', {layout:false});	

/**
 * Adding not checked yet
 */
app.engine('html', require('ejs').renderFile);

/**
 * Setting public directory
 */
app.set('views', __dirname + '/public');

/**
 * END - Initialization of dependencies for the application
 */

/**
 * Setting Routes for all the rest request to the page
 * @param app, connection, logger, bodyparser, session
 */
require('./app/routes')(app, connection, logger, bodyParser, https, parser);

/**
 * Runs the server on specified port
 * @param port
 */
//app.listen(port);
https.createServer(https_options, app).listen(port, function() {
    logger.info('Server up and running on port ' + port + '!' );
});

