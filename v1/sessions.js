"use strict";
const HyperSwitch = require('hyperswitch');
const HTTPError = HyperSwitch.HTTPError;
const URI = HyperSwitch.URI;
const fixedTid = '11111111-1111-1111-1111-111111111111';

var sessionTable = {
    name: 'auth_sessions',
    uri: '/wikimedia.org/sys/table/auth_sessions',
    entryURI: new URI(['wikimedia.org', 'sys', 'table', 'auth_sessions', '']),
    schema: {
        table: 'auth_sessions',
        version: 1,
        attributes: {
            key: 'string',
            // Work-around: Use a fixed, explicit tid to disable implicit
            // revisioning in current restbase backend.
            tid: 'timeuuid',
            value: 'blob',
            deleted: 'boolean',
        },
        index: [
            { attribute: 'key', type: 'hash' },
            { attribute: 'tid', type: 'range', order: 'desc' },
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
                tid: fixedTid,
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
                tid: fixedTid,
            },
            proj: ['value', 'deleted'],
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
                '/session/{key}': {
                    'get': {
                        operationId: 'get',
                        produces: [ 'application/binary' ],
                        tags: [ 'Sessions' ],
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
                        consumes: [ 'application/binary' ],
                        tags: [ 'Sessions' ],
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
                        tags: [ 'Sessions' ],
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
