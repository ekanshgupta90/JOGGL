/**
 * JOGGL@./app/routes.js
 * @author egupta
 * @description All the rest call will be directed to this script.
 */

module.exports = function (app, connection, logger, bodyParser, https, parser) {

    /**
	 * Setting body parser for reading the request body
	 */
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());

    /**
     * GET - / - Returns the structure to query JOOGL
     */
    app.get('/', function(request, response) {
        var output = new Object();
        output.description = "Welcome to JOGGL - Integrating JIRA and Toggl data";
        var url = {
            'method' : 'GET',
            'path' : '/joggl',
            'params' : [
                {
                    'name' : 'user_agent',
                    'description' : 'name or email of the person making the request',
                    'type' : 'string',
                    'mandatory' : 'yes'
                },
                {
                    'name' : 'toggl_start_date',
                    'description' : 'start date for fetching toggl data',
                    'type' : 'YYYY-MM-DD',
                    'mandatory' : 'no'
                },
                {
                    'name' : 'toggl_end_date',
                    'description' : 'end date for fetching toggl data',
                    'type' : 'YYYY-mm-DD',
                    'mandatory' : 'no'
                },
                {
                    'name' : 'toggl_token',
                    'description' : 'Access token required for authentication',
                    'type' : 'string',
                    'mandatory' : 'yes'
                },
                {
                    'name' : 'toggl_workspace_id',
                    'description' : 'The workspace that needs to be queried',
                    'type' : 'string',
                    'mandatory' : 'yes'
                },
                {
                    'name' : 'jira_username',
                    'description' : 'Username for JIRA authentication',
                    'type' : 'string',
                    'mandatory' : 'yes'
                },
                {
                    'name' : 'jira_password',
                    'description' : 'Password for JIRA authentication',
                    'type' : 'string',
                    'mandatory' : 'yes'
                },
                {
                    'name' : 'jira_jql',
                    'description' : 'JQL query to fetch JIRA data',
                    'type' : 'string',
                    'mandatory' : 'No, but if present all other JIRA filters will be ignored.'
                },
                {
                    'name' : 'jira_due_date_start',
                    'description' : 'Start initial due date to be filtered on',
                    'type' : 'YYYY-MM-DD',
                    'mandatory' : 'yes'
                },
                {
                    'name': 'jira_due_date_end',
                    'description': 'End initial due date to be filtered on',
                    'type': 'YYYY-MM-DD',
                    'mandatory': 'yes'
                },
                {
                    'name' : 'jira_resolution_date_start',
                    'description' : 'Start resolution date to be filtered on',
                    'type' : 'YYYY-MM-DD',
                    'mandatory' : 'no'
                },
                {
                    'name': 'jira_resolution_date_end',
                    'description': 'End resolution date to be filtered on',
                    'type': 'YYYY-MM-DD',
                    'mandatory': 'no'
                }
            ]
        };
        var queries = [url];
        output.query_list = queries;
        response.json(output);
    });

    /**
	 * GET - /joggl - Input Url.
	 */
	app.get('/joggl', function(request, response) {
		logger.info('### New JOOGL interface request');
        logger.info('### #### ' + JSON.stringify(request.query));
        var toggl_body = "";
        var jira_body = "";
        var result = new Object();
        result.request = request.query;

        logger.info('### ### ### Validating request!');
        if (!request.query.user_agent ||
            !request.query.toggl_token ||
            !request.query.toggl_workspace_id ||
            !request.query.jira_username ||
            !request.query.jira_password) {
            logger.error('### ### ### Validation failed!');
            result.status = 'failure';
            result.message = 'missing mandatory params, check / for param syntax';
            response.json(result);
        }

        var toggl_path = '';
        var toggl_auth = '';
        if (request.query.user_agent === 'aquornstudio') {
             toggl_path = '/reports/api/v2/details?user_agent=' + connection.toggl_user_agent
                + '&workspace_id=' + connection.toggl_workspace_id;
            toggl_auth = connection.toggl_token + ':' + connection.toggl_api_key;
        } else {
            toggl_path = '/reports/api/v2/details?user_agent=' + request.query.user_agent
                + '&workspace_id=' + request.query.toggle_workspace_id;
            toggl_auth = request.query.toggl_token + ':' + connection.toggl_api_key;
        }

        toggl_path += '&page=1';

        var toggl_options = {
            hostname: 'toggl.com',
            port: 443,
            path: toggl_path,
            headers: {
                'Authorization': 'Basic ' + new Buffer(toggl_auth).toString('base64')
            }
        };

        /**
         * Creating JIRA query.
         * If JQL present ignore everything else.
         * Otherwise, check for mandatory Due dates.
         * Optional, add resolution dates.
         * @type {string}
         */
        var jira_url = "/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml?jqlQuery=";
        if (!request.query.jira_jql) {
            if (!request.query.jira_due_date_start ||
                !request.query.jira_due_date_end) {
                logger.error('### ### ### Missing mandatory fields!');
                result.status = 'failure';
                result.message = 'missing mandatory params for JIRA, check / for param syntax';
                response.json(result);
            } else {
                jira_url += '\'Initial+Due+Date\'+>=+' + request.query.jira_due_date_start + '+AND+' +
                    '\'Initial+Due+Date\'+<=+' + request.query.jira_due_date_end;

                if (request.query.jira_resolution_date_start ||
                        request.query.jira_resolution_date_end) {
                    jira_url += 'resolved+>=+' + request.query.jira_resolution_date_start + '+AND+' +
                        'resolved+<=+' + request.query.jira_resolution_date_end;
                }
            }
        } else {
            jira_url += request.query.jira_jql;
        }
        jira_url += '&tempMax=1000';
        jira_url += '&os_username=' + request.query.jira_username+ '&os_password=' + request.query.jira_password;

        var jira_options = {
            hostname: 'aquorn.atlassian.net',
            port: 443,
            path: jira_url
        }
        logger.info('### ### ### Fetching information from Toggl.');

        jogglData(toggl_options, jira_options, request, response);
	});

    /**
     * JogglData - does the data processing for Joggl Request.
     * @param toggl_options
     * @param jira_options
     * @param request
     * @param response
     */
    function jogglData(toggl_options, jira_options, request, response) {
        var toggl_body = "";
        var jira_body = "";
        var num_pages = 1;
        var page = 1;
        var result = new Object();
        result.request = request.query;
        var toggl_data = new Array();
        https.get(toggl_options, togglcallback);

        function togglcallback(res) {
            res.on('data', function(data) {
                toggl_body += data;
            });
            res.on('end', function(data) {
                toggl_body = JSON.parse(toggl_body);
                toggl_data = toggl_data.concat(toggl_body.data);
                if (page === 1 && toggl_body.total_count > toggl_body.per_page) {
                    num_pages = parseInt(toggl_body.total_count / toggl_body.per_page) + 1;
                }
                if (num_pages > page) {
                    logger.info('### ### ### ### Toggl data fetch page ' + (page+1));
                    toggl_body = "";
                    toggl_options.path = toggl_options.path.substr(0, toggl_options.path.length - 1) + (++page);
                    https.get(toggl_options, togglcallback);
                } else {
                    logger.info('### ### ### ### Toggl data fetch complete.');
                    logger.info('### ### ### ### ### Fetching information from JIRA.');
                    logger.info('### ### ### ### ### Querying JIRA on - ' + jira_options.path);
                    https.get(jira_options, jiracallback);
                }

            });
            res.on('error', function(error) {
                logger.error('## ### ### ### XXX' + e);
                logger.info('### ### ### ### ### Returning error message for the request.');
                result.status = 'failure';
                result.message = 'Failed to query Toggl data at Page - ' + page + ' with error: ' + e;
                response.json(result);
            });
        }

        function jiracallback(res) {
            res.on('data', function(data) {
                jira_body += data;
            });
            res.on('end', function(data) {
                var jira_key_map = new Object();
                var output_items = new Array();
                logger.info('### ### ### ### ### ### JIRA data fetch complete.');
                if (!jira_body  || jira_body === '') {
                    logger.error('### ### ### ### ### ### Ill framed JQL query, exiting!');
                    result.status = 'failure';
                    result.message = 'problem framing JIRA JQL query -> ' + jira_options.path;
                    response.json(result);
                }
                var jira_xml = new parser.XmlDocument(jira_body);

                logger.info('### ### ### ### ### ### ### JOGGLing data.');

                var jira_channel = jira_xml.descendantWithPath('channel');
                var jira_items = jira_channel.childrenNamed('item');

                logger.info('### ### ### ### ### ### ### ### Creating JIRA data key index.');
                for (i = 0; i < jira_items.length; i++) {
                    jira_key_map[jira_items[i].childNamed('key').val] = i;
                }

                logger.info('### ### ### ### ### ### ### ### ### Mapping JIRA and Toggl data.');
                for (i = 0; i < toggl_data.length; i++) {
                    var toggl_item = toggl_data[i];
                    var jira_index = -1;
                    for (var key in jira_key_map) {
                        var search_key = new RegExp(key + '\\b', 'i');
                        if (toggl_item.description.search(search_key) >= 0 ||
                            toggl_item.description.indexOf('[' + key + ']') >= 0) {
                            jira_index = jira_key_map[key];
                            break;
                        } else {
                            for (k = 0; k < toggl_item.tags.length; k++) {
                                if (toggl_item.tags[k].indexOf(key) >= 0) {
                                    jira_index = jira_key_map[key];
                                    break;
                                }
                            }
                            if (jira_index >= 0) {
                                break;
                            }
                        }
                    }
                    if (jira_index >= 0) {
                        var item = new Object();
                        item.toggl_description = toggl_item.description;
                        item.toggl_user = toggl_item.user;
                        item.toggl_start = toggl_item.start;
                        item.toggl_end = toggl_item.end;
                        item.toggl_tags = toggl_item.tag;
                        item.toggl_duration = toggl_item.dur;

                        var jira_item = jira_items[jira_index];
                        item.jira_id = jira_item.childNamed('key').val;
                        item.jira_summary = jira_item.childNamed('summary').val;
                        item.jira_created = jira_item.childNamed('created').val;
                        item.jira_updated = jira_item.childNamed('updated').val;
                        item.jira_due = jira_item.childNamed('due').val;
                        if (jira_item.childNamed('timeestimate')) {
                            item.jira_estimated_time = jira_item.childNamed('timeestimate').attr.seconds;
                        } else {
                            item.jira_estimated_time = "";
                        }
                        item.jira_status = jira_item.childNamed('status').val;
                        item.jira_description = jira_item.childNamed('description').val;
                        item.jira_assignee = jira_item.childNamed('assignee').val;

                        var custom_fields = jira_item.childNamed('customfields');
                        var custom_fields = custom_fields.childrenNamed('customfield');
                        for (index = 0; index < custom_fields.length; index++) {
                            field = custom_fields[index];
                            if (field.childNamed('customfieldname').val === 'Initial Due Date') {
                                item.jira_initial_due_date = field.childNamed('customfieldvalues').
                                childrenNamed('customfieldvalue')[0].val;
                                break;
                            }
                        }
                        output_items.push(item);
                    }
                }
                logger.info('### ### ### ### ### ### ### ### ### ### JOGGLing Complete, sending data!');
                logger.info('### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ###');
                result.status = 'success';
                result.message = '';
                result['result'] = output_items;
                response.json(result);
            });
            res.on('error', function(error) {
                logger.error('## ### ### ### XXX' + e);
                logger.info('### ### ### ### ### Returning error message for the request.');
                result.status = 'failure';
                result.message = 'Failed to query JIRA data with error: ' + e;
                response.json(result);
            });
        }
    }
};
