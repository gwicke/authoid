"use strict";
var HyperSwitch = require('hyperswitch');
var HTTPError = HyperSwitch.HTTPError;
var URI = HyperSwitch.URI;

var sessionTable = {
    name: 'auth_sessions',
    uri: '/wikimedia.org/sys/table/auth_sessions',
    entryURI: new URI(['wikimedia.org', 'sys', 'table', 'auth_sessions', '']),
    schema: {
        table: 'auth_sessions',
        version: 1,
        attributes: {
            key: 'string',
            value: 'blob',
            deleted: 'boolean',
        },
        index: [
            { attribute: 'key', type: 'hash' },
        ],
        revisionRetentionPolicy: {
            type: 'ttl',
            // TODO: configure
            ttl: 86400
        }
    }
};

function put(hyper, req) {
    return hyper.post({
        uri: sessionTable.entryURI,
        body: {
            table: sessionTable.name,
            attributes: {
                key: req.params.key,
                value: req.body,
                deleted: false,
            }
        }
    });
}

function get(hyper, req) {
    return hyper.get({
        uri: sessionTable.entryURI,
        body: {
            table: sessionTable.name,
            attributes: {
                key: req.params.key,
            },
            limit: 1,
        }
    })
    .then(function(res) {
        const body = res.body.items[0];
        if (body.deleted) {
            throw new HTTPError({
                status: 404,
                body: {
                    title: 'not_found'
                }
            });
        } else {
            res.body = body.value;
            res.headers = {
                'content-type': 'application/binary',
            };
            return res;
        }
    });
}

function del(hyper, req) {
    return hyper.post({
        uri: sessionTable.entryURI,
        body: {
            table: sessionTable.name,
            attributes: {
                key: req.params.key,
                deleted: true,
            }
        }
    });
}


module.exports = function(options) {
    if (options && options.ttl) {
        sessionTable.schema.revisionRetentionPolicy.ttl = options.ttl;
    }
    return {
        spec: {
            paths: {
                '/{key}': {
                    'get': {
                        operationId: 'get',
                        produces: 'application/binary',
                        parameters: [
                        {
                            name: 'key',
                            in: 'path',
                            type: 'string',
                            required: 'true',
                            description: 'Session key',
                        }]
                    },
                    'put': {
                        operationId: 'put',
                        consumes: 'application/binary',
                        parameters: [
                        {
                            name: 'key',
                            in: 'path',
                            type: 'string',
                            required: 'true',
                            description: 'Session key',
                        },
                        {
                            name: 'body',
                            in: 'body',
                            required: 'true',
                            description: 'Session value as a blob',
                        }],
                    },
                    'delete': {
                        operationId: 'del',
                        parameters: [
                        {
                            name: 'key',
                            in: 'path',
                            type: 'string',
                            required: 'true',
                            description: 'Session key',
                        }]
                    }
                }
            }
        },
        operations: {
            get: get,
            put: put,
            del: del,
        },
        resources: [
            {
                uri: sessionTable.uri,
                body: sessionTable.schema
            }
        ]
    };
};
